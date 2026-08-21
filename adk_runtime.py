"""The one place that starts an ADK run.

Four places in this project made a `Runner`, gave it a session service, and then
read the events of the run in a loop. The four loops were the same text, so a
correction to one loop did not go to the other three. This module holds one copy
of each loop.

There are two functions and not one, because `Runner` has two different
parameters for the work. A single agent goes to `agent=`. A graph workflow goes to
`node=`. The two kinds of run also give different results: an agent gives text,
and the workflow gives nothing because its last node writes to Firestore.

No function here raises an HTTP error, and that is on purpose. An empty result is
not always a failure. The generator must answer 502 if the text is empty, but the
curator must answer with an empty list. Only the caller knows which is correct.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from google.adk import Runner
from google.adk.agents import BaseAgent
from google.adk.sessions import InMemorySessionService
from google.adk.workflow import BaseNode
from google.genai import types as genai_types

import config
import store
from models import RunEventState

logger = logging.getLogger(__name__)

APP_NAME = "projectsync"
"""The name of this application in the session service."""

# The session service holds the events of one run. `InMemorySessionService` is
# correct here, because one Phase 1 run finishes inside one request. The pause for
# the approval does not use a session: it uses a row in Firestore. Python
# `google-adk` 2.7.0 has no Firestore session service, and each other durable
# choice needs a third Google Cloud service.
#
# One instance is enough for all runs. The `session_id` of each run keeps the
# events of that run apart from the events of the others.
_session_service = InMemorySessionService()


def _user_message(text: str) -> genai_types.Content:
    """Put text in the user content that `run_async` needs."""
    return genai_types.Content(role="user", parts=[genai_types.Part(text=text)])


async def run_agent_for_text(
    agent: BaseAgent, prompt: str, *, user_id: str, session_id: str
) -> str:
    """Run one agent on one prompt, and give the text of its last full answer.

    The loop keeps the text of the last event that is not partial, and writes over
    the text of each earlier event. A partial event holds one piece of a stream, so
    a sum of all events gives the same words two times.

    A part that is a thought is not part of the answer. The agents in this project
    all have an `output_schema`, so the text is JSON, and a thought inside it makes
    the validation fail. The loop drops each thought part.

    The result is an empty string if the agent gives no text. This function does
    not decide what an empty string means. The caller decides.
    """
    runner = Runner(
        agent=agent,
        app_name=APP_NAME,
        session_service=_session_service,
        auto_create_session=True,
    )

    text = ""
    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=_user_message(prompt),
    ):
        if event.content and event.content.parts and not event.partial:
            text = "".join(
                part.text for part in event.content.parts if part.text and not part.thought
            )
    return text


# Node names in the graph — must match the ADK node names exactly
GRAPH_NODES = (
    "scan_github_repository",
    "extraction_agent",
    "attach_style_rules",
    "asset_generator_agent",
    "select_evaluator_input",
    "path_evaluator_agent",
    "persist_transaction",
)


async def run_workflow(
    node: BaseNode, prompt: str, *, user_id: str, session_id: str, state: dict
) -> None:
    """Run a graph workflow one time, and write each node failure to the log.

    The values in `state` go into the run with the `state_delta` argument. The first
    node then reads them from the state by their names. The START node gives user
    content of the type `types.Content`, and that type does not change into a model,
    so the state is the correct path for the first input.

    The function gives nothing back. The last node of the workflow writes the result
    to Firestore, and the client reads the row.

    A node that fails does not stop this loop, because the framework puts the error
    in an event and continues. The loop writes each such error to the log. The
    caller gets an exception only if the run itself stops.

    If `config.FIXTURE_MODE` is true, this function does not call the model.
    Instead it writes a canned transaction to Firestore and returns immediately.

    This function also persists a per-node event log and checks for cooperative
    cancellation between nodes.
    """
    tx_id = state.get("tx_id") or state.get("transaction_id")
    if not tx_id:
        logger.error("No transaction_id in state, cannot log events or check cancel")
        # Fall back to old behavior without events/cancel
        return await _run_workflow_legacy(node, prompt, user_id, session_id, state)

    # FIXTURE_MODE: serve a canned transaction, zero model calls
    if config.FIXTURE_MODE:
        fixture_path = Path(__file__).parent / "tests" / "fixtures" / "canned_transaction.json"
        if fixture_path.exists():
            with open(fixture_path) as f:
                canned = json.load(f)
            # Write the canned transaction to Firestore so the rest of the flow works
            from models import Transaction, TransactionStatus

            # Keep the tx_id that the caller resolved above. The client polls the
            # row under the id that the trigger gave it, so the fixture must save
            # under that same id, and not under the id inside the fixture file. An
            # overwrite here left the client's row at RUNNING for ever.
            store.save_transaction(
                Transaction(
                    tx_id=tx_id,
                    user_id=user_id,
                    repo_name=canned.get("repo_name", "fixture/repo"),
                    repo_url=canned.get("repo_url", "https://github.com/fixture/repo"),
                    status=TransactionStatus(canned.get("status", "PENDING_APPROVAL")),
                    metadata=canned.get("metadata"),
                    asset_versions=[],
                    created_at=store.now_iso(),
                )
            )
            # Update with assets if present
            if canned.get("assets"):
                from models import AssetSource, AssetVersion, GeneratedAssets
                assets = GeneratedAssets(**canned["assets"])
                version = AssetVersion(
                    assets=assets,
                    source=AssetSource.GENERATED,
                    created_at=store.now_iso(),
                    style_rules_applied=[],
                )
                store.update_transaction(
                    tx_id,
                    asset_versions=[version.model_dump(mode="json")],
                    status=canned.get("status", "PENDING_APPROVAL"),
                )
            return
        logger.warning("FIXTURE_MODE=1 but no fixture found at %s", fixture_path)

    runner = Runner(
        node=node,
        app_name=APP_NAME,
        session_service=_session_service,
        auto_create_session=True,
    )

    # Track the current node so the log gets a start and a finish for each one.
    # The value is -1 before the first node, and not 0. If it started at 0, the
    # first node (index 0) would fail the `node_idx > current_node_idx` test, and
    # the log would miss the STARTED event of the first node.
    current_node_idx = -1

    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        state_delta=state,
        new_message=_user_message(prompt),
    ):
        # Check for cooperative cancellation between nodes
        if store.cancel_requested(tx_id):
            logger.info("Cancellation requested for %s, stopping run", tx_id)
            node_name = (
                GRAPH_NODES[current_node_idx]
                if 0 <= current_node_idx < len(GRAPH_NODES)
                else "unknown"
            )
            store.append_run_event(
                tx_id,
                node_name,
                RunEventState.CANCELLED,
                error="Cooperative cancellation requested by user",
            )
            store.update_transaction(
                tx_id,
                status="CANCELLED",
                error_message="Cancelled by user",
                completed_at=store.now_iso(),
            )
            return

        # Detect node transitions from the author field
        if event.author and event.author in GRAPH_NODES:
            node_idx = GRAPH_NODES.index(event.author)
            if node_idx > current_node_idx:
                # The previous node finished. Skip this on the first node, when
                # there is no previous node yet and the index is still -1. A write
                # here would use GRAPH_NODES[-1] and log the last node by mistake.
                if current_node_idx >= 0:
                    store.append_run_event(
                        tx_id,
                        GRAPH_NODES[current_node_idx],
                        RunEventState.COMPLETED,
                        finished_at=store.now_iso(),
                    )
                # New node started
                current_node_idx = node_idx
                store.append_run_event(
                    tx_id,
                    event.author,
                    RunEventState.STARTED,
                    started_at=store.now_iso(),
                )

        if event.error_message:
            logger.error("The node %s failed: %s", event.author, event.error_message)
            if event.author in GRAPH_NODES:
                store.append_run_event(
                    tx_id,
                    event.author,
                    RunEventState.FAILED,
                    finished_at=store.now_iso(),
                    error=event.error_message,
                )

    # Mark the last node that started as completed. Skip this if no node started.
    if 0 <= current_node_idx < len(GRAPH_NODES):
        store.append_run_event(
            tx_id,
            GRAPH_NODES[current_node_idx],
            RunEventState.COMPLETED,
            finished_at=store.now_iso(),
        )


async def _run_workflow_legacy(
    node: BaseNode, prompt: str, *, user_id: str, session_id: str, state: dict
) -> None:
    """Legacy run without event logging or cancellation checks."""
    runner = Runner(
        node=node,
        app_name=APP_NAME,
        session_service=_session_service,
        auto_create_session=True,
    )

    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        state_delta=state,
        new_message=_user_message(prompt),
    ):
        if event.error_message:
            logger.error("The node %s failed: %s", event.author, event.error_message)
