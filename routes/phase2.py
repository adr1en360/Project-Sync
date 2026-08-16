"""Phase 2: write the two commits after a person approves, then look for a rule.

Phase 2 is a different request from Phase 1, and it can come minutes or days later.
Cloud Run goes to zero instances between the two, so the resume point is a row in
Firestore and the resume trigger is an HTTP request.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException

import adk_runtime
import store
from memory import curator
from models import ApprovalRequest, TransactionStatus
from sync import github as github_sync

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["phase 2"])


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

    text = await adk_runtime.run_agent_for_text(
        curator.build_rule_curator_agent(),
        prompt,
        user_id=user_id,
        session_id=f"curator-{store.new_id()}",
    )

    if not text.strip():
        return []
    proposed = curator.ProposedRules.model_validate_json(text)
    saved = curator.save_proposed_rules(user_id, proposed.rules, transaction_id)
    return [rule.text for rule in saved]


@router.post("/approval-callback")
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
