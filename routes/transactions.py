"""Transaction control and history endpoints."""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, HTTPException

import store
from models import SyncRequest, TransactionStatus
from routes.phase1 import _run_phase1

router = APIRouter(prefix="/api/v1", tags=["transactions"])


@router.get("/transactions")
async def list_transactions(
    user_id: str = "default",
    status: str | None = None,
    limit: int = 20,
) -> list[dict]:
    """List transactions for one user, optionally filtered by status.

    Returns newest first.
    """
    status_enum = TransactionStatus(status) if status else None
    rows = store.list_transactions(user_id, status_enum, limit)
    return [row.model_dump(mode="json") for row in rows]


@router.get("/transactions/{tx_id}/events")
async def get_run_events(tx_id: str) -> list[dict]:
    """Get the per-node event log for one transaction."""
    transaction = store.get_transaction(tx_id)
    if transaction is None:
        raise HTTPException(status_code=404, detail="No such transaction.")
    events = store.run_events(tx_id)
    return [event.model_dump(mode="json") for event in events]


@router.post("/transactions/{tx_id}/cancel")
async def cancel_transaction(tx_id: str) -> dict:
    """Request cooperative cancellation of a running transaction.

    The flag is checked between nodes in adk_runtime.run_workflow.
    """
    transaction = store.get_transaction(tx_id)
    if transaction is None:
        raise HTTPException(status_code=404, detail="No such transaction.")

    if transaction.status != TransactionStatus.RUNNING:
        raise HTTPException(
            status_code=409, detail=f"Cannot cancel a transaction in {transaction.status} state."
        )

    store.set_cancel_requested(tx_id, True)
    return {"status": "cancel_requested", "transaction_id": tx_id}


# The states that a resume can start from. A run that stopped for one of these
# reasons is safe to start again.
_RESUMABLE = (
    TransactionStatus.CANCELLED,
    TransactionStatus.FAILED_SCAN,
    TransactionStatus.FAILED_EXTRACTION,
    TransactionStatus.FAILED_GENERATION,
)


@router.post("/transactions/{tx_id}/resume")
async def resume_transaction(tx_id: str, background: BackgroundTasks) -> dict:
    """Run Phase 1 again for a stopped transaction, under the same identifier.

    The graph does not keep the output of each node. Only the last node writes
    the row, and Cloud Run goes to zero between runs. So the state of a stopped
    run is gone, and a resume from the middle is not possible. A resume is a new
    run of Phase 1 from the start, under the same transaction identifier. The
    last node writes over the row, so the identifier in the client does not
    change.

    The row does not keep the commit, so the new run reads the head of the
    branch.
    """
    transaction = store.get_transaction(tx_id)
    if transaction is None:
        raise HTTPException(status_code=404, detail="No such transaction.")

    if transaction.status not in _RESUMABLE:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot resume a transaction in {transaction.status} state.",
        )

    # Clear the cancel flag, and show RUNNING at once. A poll during the new run
    # then shows RUNNING, and not the old error.
    store.set_cancel_requested(tx_id, False)
    store.update_transaction(
        tx_id,
        status=TransactionStatus.RUNNING.value,
        error_message=None,
        completed_at=None,
    )

    # Build the request from the row, and run the graph again under the same id.
    request = SyncRequest(repo_url=transaction.repo_url, user_id=transaction.user_id)
    background.add_task(_run_phase1, request, tx_id)
    return {"transaction_id": tx_id, "status": TransactionStatus.RUNNING.value}