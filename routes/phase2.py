"""Phase 2: write the two commits after a person approves, then look for a rule.

Phase 2 is a different request from Phase 1, and it can come minutes or days later.
Cloud Run goes to zero instances between the two, so the resume point is a row in
Firestore and the resume trigger is an HTTP request.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException

import store
from memory import curator
from models import ApprovalRequest, AssetSource, AssetVersion, TransactionStatus
from sync import github as github_sync

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["phase 2"])


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

    # If the person edited the assets, append a HUMAN_EDITED version so the
    # curator can see the before/after difference. If they didn't edit, append
    # the generated version as GENERATED.
    source = AssetSource.HUMAN_EDITED if request.edited_assets else AssetSource.GENERATED
    new_version = AssetVersion(
        assets=assets,
        source=source,
        created_at=store.now_iso(),
        style_rules_applied=(
            transaction.style_rules_applied if source == AssetSource.GENERATED else []
        ),
    )
    versions = [version.model_dump(mode="json") for version in transaction.asset_versions]
    versions.append(new_version.model_dump(mode="json"))

    _update(
        request.transaction_id,
        status=(
            TransactionStatus.COMPLETED.value
            if both_done
            else TransactionStatus.PARTIAL.value
        ),
        doc_commit_sha=results.doc_commit_sha,
        card_commit_sha=results.card_commit_sha,
        asset_versions=versions,
        style_rules_applied=transaction.style_rules_applied,
        completed_at=store.now_iso() if both_done else None,
    )

    # Write the error field on its own, and not through `_update`. `_update` drops
    # a `None`, so a success would keep a stale error from an earlier partial run.
    # A direct write puts `None` on success, which clears the old error, and puts
    # the real error on a partial result.
    store.update_transaction(
        request.transaction_id,
        error_message=results.doc_error or results.card_error,
    )

    # Fill the bullet bank from the approved assets, but only when both commits
    # land. The commits are already written, so a seed failure must not fail the
    # approval. The guard stops a duplicate on a resume, which runs Phase 1 again
    # under the same transaction id.
    if both_done and assets.resume_bullets:
        try:
            if not store.bullets_exist_for_tx(request.transaction_id):
                store.seed_bullets(
                    user_id=transaction.user_id,
                    tx_id=request.transaction_id,
                    project_name=(
                        transaction.metadata.project_name
                        if transaction.metadata
                        else transaction.repo_name
                    ),
                    resume_bullets=assets.resume_bullets,
                )
        except Exception:
            logger.exception("The bullet auto-seed failed. The approval stands.")

    proposed: list[str] = []
    try:
        # Use the new function that also checks for default rule proposals
        proposed = await curator.run_curator_with_defaults(
            transaction.user_id, request.transaction_id
        )
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
