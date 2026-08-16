"""The FastAPI application. Five endpoints and one health check.

The design has two phases, and the split is the reason that the whole thing works
on Cloud Run.

Phase 1 is one request. It runs the graph, writes `PENDING_APPROVAL` to
Firestore, and returns. It does not hold a thread open and does not wait for a
person.

Phase 2 is a different request, and it can come minutes or days later. Cloud Run
goes to zero instances between the two, so the resume point is a row in Firestore
and the resume trigger is an HTTP request.

The status endpoint polls. A graph workflow does not support live streaming, so
the client asks again and does not hold a stream open.

This module also serves the review desk in `static/`. That interface is plain
HTML, CSS, and JavaScript, with no build step. One container holds the API and
the interface together, so the deploy stays at one Cloud Run service.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from google.adk import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types as genai_types
from pydantic import BaseModel

import config
import store
from graph import build_phase1_workflow
from memory import curator
from models import (
    AssetGenInput,
    GeneratedAssets,
    RuleSource,
    RuleState,
    SyncRequest,
    Transaction,
    TransactionStatus,
)
from nodes.generator import build_asset_generator_agent
from nodes.scanner import ScanError, parse_repo_url
from sync import github as github_sync

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="ProjectSync",
    description="Turns a finished GitHub repository into career-ready outputs.",
    version="0.1.0",
)

# The interface comes from this same service, so a browser needs no CORS rule for
# it. The middleware goes on only if `ALLOWED_ORIGINS` names a different host.
# An open list is a real risk here, because every endpoint writes to GitHub or to
# Firestore.
if config.ALLOWED_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.ALLOWED_ORIGINS,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

# The review desk. The files are plain HTML, CSS, and JavaScript, so there is no
# build step and the container needs no Node.
_STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=_STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
def review_desk() -> FileResponse:
    """Give the review desk.

    The route is explicit and not a mount at the root path. A mount at the root
    path can hide an API route, and this way the order of the routes is clear.
    """
    return FileResponse(_STATIC_DIR / "index.html")

# The session service holds the events of one graph run. `InMemorySessionService`
# is correct here, because one Phase 1 run finishes inside one request. The pause
# for the approval does not use a session: it uses a row in Firestore. Python
# `google-adk` 2.7.0 has no Firestore session service, and each other durable
# choice needs a third Google Cloud service.
_session_service = InMemorySessionService()

APP_NAME = "projectsync"


# --------------------------------------------------------------------------
# Health
# --------------------------------------------------------------------------


@app.get("/healthz")
def healthz() -> dict:
    """Tell if the service is up, and which settings are absent.

    The check reports the model, because the model is a pass or fail gate for the
    submission. The import of `config` fails if the model is below the floor, so a
    reply from this endpoint proves that the pin is correct.
    """
    return {
        "status": "ok",
        "model": config.MODEL,
        "use_vertex_ai": config.USE_VERTEX_AI,
        "missing_config": config.missing_required(),
    }


# --------------------------------------------------------------------------
# Phase 1
# --------------------------------------------------------------------------


async def _run_phase1(request: SyncRequest, tx_id: str) -> None:
    """Run the graph one time and write the result.

    The values of the request go into the state with `state_delta`. The first node
    reads them from the state by their names. The START node gives user content of
    the type `types.Content`, and that type does not change into a model, so the
    state is the correct path for the first input.
    """
    runner = Runner(
        node=build_phase1_workflow(),
        app_name=APP_NAME,
        session_service=_session_service,
        auto_create_session=True,
    )

    try:
        async for event in runner.run_async(
            user_id=request.user_id,
            session_id=tx_id,
            state_delta={
                "tx_id": tx_id,
                "repo_url": request.repo_url,
                "user_id": request.user_id,
                "commit_sha": request.commit_sha,
            },
            new_message=genai_types.Content(
                role="user",
                parts=[genai_types.Part(text=f"Catalogue {request.repo_url}")],
            ),
        ):
            if event.error_message:
                logger.error(
                    "The node %s failed: %s", event.author, event.error_message
                )
    # Catch every error here. The row must record each failure, because the client
    # polls the row and has no other way to learn that the run stopped.
    except Exception as error:
        logger.exception("The Phase 1 run %s failed.", tx_id)
        _record_failure(tx_id, error)


def _record_failure(tx_id: str, error: Exception) -> None:
    """Write the failure to the row, and choose the correct status.

    No step fails quietly. The status names the step that failed, so the client
    shows which part to retry.
    """
    if isinstance(error, ScanError):
        status = TransactionStatus.FAILED_SCAN
    elif "Extract" in type(error).__name__:
        status = TransactionStatus.FAILED_EXTRACTION
    else:
        status = TransactionStatus.FAILED_GENERATION

    try:
        store.fail_transaction(tx_id, status, str(error))
    # Firestore can also be down. This handler is the last one, so it writes the
    # problem to the log and stops there.
    except Exception:
        logger.exception("The failure of %s could not be written.", tx_id)


@app.post("/api/v1/trigger-sync")
async def trigger_sync(request: SyncRequest, background: BackgroundTasks) -> dict:
    """Start Phase 1 for one repository.

    The endpoint gives back a transaction identifier at once, and the graph runs
    behind the request. The client then polls the status endpoint. A graph workflow
    does not support live streaming, so a poll is the correct pattern.
    """
    try:
        repo_name = parse_repo_url(request.repo_url)
    except ScanError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    tx_id = store.new_id()

    # Write the row before the graph starts. If the process stops in the middle of
    # the run, the row still shows that the run began.
    store.save_transaction(
        Transaction(
            tx_id=tx_id,
            user_id=request.user_id,
            repo_url=request.repo_url,
            repo_name=repo_name,
            status=TransactionStatus.RUNNING,
            created_at=store.now_iso(),
        )
    )

    background.add_task(asyncio.create_task, _run_phase1(request, tx_id))
    return {"transaction_id": tx_id, "status": TransactionStatus.RUNNING.value}


@app.get("/api/v1/transactions/{tx_id}")
def get_transaction(tx_id: str) -> Transaction:
    """Give the state of one transaction. The client polls this endpoint."""
    transaction = store.get_transaction(tx_id)
    if transaction is None:
        raise HTTPException(status_code=404, detail=f"No transaction {tx_id}.")
    return transaction


# --------------------------------------------------------------------------
# Regenerate
# --------------------------------------------------------------------------


class RegenerateRequest(BaseModel):
    """What a client sends to make the assets of one transaction again."""

    transaction_id: str


async def _run_generator(payload: AssetGenInput, session_id: str) -> GeneratedAssets:
    """Run only the generator agent on one input, and give the four assets.

    The agent gets the input as the message of the user, in JSON. There is no
    template field in the instruction, because the template engine accepts only a
    name that is a valid Python identifier. A name with a dot in it stays in the
    text as it is, and then the rules have no effect.
    """
    runner = Runner(
        agent=build_asset_generator_agent(),
        app_name=APP_NAME,
        session_service=_session_service,
        auto_create_session=True,
    )

    text = ""
    async for event in runner.run_async(
        user_id="regenerate",
        session_id=session_id,
        new_message=genai_types.Content(
            role="user", parts=[genai_types.Part(text=payload.model_dump_json())]
        ),
    ):
        if event.content and event.content.parts and not event.partial:
            text = "".join(
                part.text for part in event.content.parts if part.text and not part.thought
            )

    if not text.strip():
        raise HTTPException(status_code=502, detail="The generation gave no output.")
    return GeneratedAssets.model_validate_json(text)


@app.post("/api/v1/regenerate-asset")
async def regenerate_asset(request: RegenerateRequest) -> dict:
    """Make the four assets again with the rules that are ACTIVE now.

    The endpoint does not scan the repository again and does not run the
    extraction agent again. It uses the metadata that is already in Firestore.

    This is what makes a rule change show on the review that is open now, and not
    only on the next repository.
    """
    transaction = store.get_transaction(request.transaction_id)
    if transaction is None:
        raise HTTPException(status_code=404, detail="No such transaction.")
    if transaction.metadata is None:
        raise HTTPException(
            status_code=409, detail="This transaction has no metadata to use."
        )

    rules = store.active_style_rules(transaction.user_id)
    payload = AssetGenInput(
        metadata=transaction.metadata,
        style_rules=[rule.text for rule in rules],
        style_rule_ids=[rule.rule_id for rule in rules],
    )
    assets = await _run_generator(payload, session_id=f"regen-{store.new_id()}")

    store.update_transaction(
        request.transaction_id,
        assets=assets.model_dump(mode="json"),
        style_rules_applied=[rule.rule_id for rule in rules],
    )
    return {
        "transaction_id": request.transaction_id,
        "assets": assets.model_dump(mode="json"),
        "style_rules_applied": [rule.text for rule in rules],
    }


# --------------------------------------------------------------------------
# Phase 2
# --------------------------------------------------------------------------


class ApprovalRequest(BaseModel):
    """What the approve action and the discard action send."""

    transaction_id: str
    approved: bool = True
    edited_assets: GeneratedAssets | None = None


async def _run_curator(user_id: str, transaction_id: str) -> list[str]:
    """Look for a style pattern in past approvals, and propose a rule.

    Every rule that this step writes is `PROPOSED`. A person must click one time
    to make a rule `ACTIVE`.

    The function gives an empty list if the person has too few completed rows. Two
    rows are the minimum, because one project is not a pattern.
    """
    prompt = curator.build_curator_prompt(user_id)
    if prompt is None:
        return []

    runner = Runner(
        agent=curator.build_rule_curator_agent(),
        app_name=APP_NAME,
        session_service=_session_service,
        auto_create_session=True,
    )

    text = ""
    async for event in runner.run_async(
        user_id=user_id,
        session_id=f"curator-{store.new_id()}",
        new_message=genai_types.Content(
            role="user", parts=[genai_types.Part(text=prompt)]
        ),
    ):
        if event.content and event.content.parts and not event.partial:
            text = "".join(
                part.text for part in event.content.parts if part.text and not part.thought
            )

    if not text.strip():
        return []
    proposed = curator.ProposedRules.model_validate_json(text)
    saved = curator.save_proposed_rules(user_id, proposed.rules, transaction_id)
    return [rule.text for rule in saved]


@app.post("/api/v1/approval-callback")
async def approval_callback(request: ApprovalRequest) -> dict:
    """Write the two commits after a person approves.

    The two commits are independent. If one fails and the other succeeds, the row
    keeps both facts and the client offers a retry for only the part that failed. A
    partial failure is a partial success.

    The rule curator runs last, and a failure there does not fail the approval.
    """
    transaction = store.get_transaction(request.transaction_id)
    if transaction is None:
        raise HTTPException(status_code=404, detail="No such transaction.")

    if not request.approved:
        _update(
            request.transaction_id,
            status=TransactionStatus.REJECTED.value,
            completed_at=store.now_iso(),
        )
        return {"status": TransactionStatus.REJECTED.value}

    assets = request.edited_assets or transaction.assets
    if assets is None:
        raise HTTPException(status_code=409, detail="This transaction has no assets.")

    results = github_sync.commit_assets(
        target_repo=transaction.repo_name,
        project_name=(
            transaction.metadata.project_name
            if transaction.metadata
            else transaction.repo_name
        ),
        assets=assets,
        repo_url=transaction.repo_url,
    )

    # Both commits must land for the row to become COMPLETED. A row with one
    # commit stays open, so the client can retry only the part that failed.
    both_done = bool(results.doc_commit_sha and results.card_commit_sha)
    _update(
        request.transaction_id,
        status=(
            TransactionStatus.COMPLETED.value
            if both_done
            else TransactionStatus.PARTIAL.value
        ),
        doc_commit_sha=results.doc_commit_sha,
        card_commit_sha=results.card_commit_sha,
        error_message=results.doc_error or results.card_error,
        assets=assets.model_dump(mode="json"),
        completed_at=store.now_iso() if both_done else None,
    )

    proposed: list[str] = []
    try:
        proposed = await _run_curator(transaction.user_id, request.transaction_id)
    # The curator is an extra, and the commits are already written. A failure here
    # must not fail the approval.
    except Exception:
        logger.exception("The curator step failed. The approval stands.")

    return {
        "status": (
            TransactionStatus.COMPLETED.value
            if both_done
            else TransactionStatus.PARTIAL.value
        ),
        "doc_commit_sha": results.doc_commit_sha,
        "card_commit_sha": results.card_commit_sha,
        "doc_error": results.doc_error,
        "card_error": results.card_error,
        "proposed_rules": proposed,
    }


def _update(tx_id: str, **fields: Any) -> None:
    """Write only the fields that have a value.

    A field with the value `None` would write a null over good data. An example is
    `completed_at` on a partial result.
    """
    store.update_transaction(tx_id, **{k: v for k, v in fields.items() if v is not None})


# --------------------------------------------------------------------------
# Style rules
# --------------------------------------------------------------------------


class RuleStateRequest(BaseModel):
    """What the change of one rule sends."""

    state: RuleState


class NewRuleRequest(BaseModel):
    """What a person sends to write a rule by hand."""

    user_id: str = "default"
    text: str


@app.get("/api/v1/rules")
def list_rules(user_id: str = "default") -> list:
    """Give every rule of one person, in each of the three states."""
    return [rule.model_dump(mode="json") for rule in store.all_style_rules(user_id)]


@app.post("/api/v1/rules")
def create_rule(request: NewRuleRequest) -> dict:
    """Write one rule by hand. The new rule is `PROPOSED`, like every other rule."""
    rule = store.write_style_rule(
        user_id=request.user_id, text=request.text, source=RuleSource.USER
    )
    return rule.model_dump(mode="json")


@app.post("/api/v1/rules/{rule_id}")
def toggle_rule(rule_id: str, request: RuleStateRequest) -> dict:
    """Change one rule to ACTIVE, INACTIVE, or PROPOSED.

    The rules are read new on every run, so this change takes effect on the next
    generation. There is no new deploy and no restart.
    """
    store.set_rule_state(rule_id, request.state)
    return {"rule_id": rule_id, "state": request.state.value}
