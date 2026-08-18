"""Phase 1: start a run on one repository, and read the state of a run.

Phase 1 is one request. It runs the graph, writes `PENDING_APPROVAL` to Firestore,
and returns. It does not hold a thread open and does not wait for a person.

The status endpoint polls. A graph workflow does not support live streaming, so the
client asks again and does not hold a stream open.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException

import adk_runtime
import store
from graph import build_phase1_workflow
from models import SyncRequest, Transaction, TransactionStatus
from nodes.scanner import ScanError, parse_repo_url

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["phase 1"])


async def _run_phase1(request: SyncRequest, tx_id: str) -> None:
    """Run the graph one time, and write a failure to the transaction row.

    This function runs behind the request. No client waits for it, and no client can
    see an exception from it. So each failure must go to the row, because the row is
    the only thing that the client reads.

    The session identifier is the transaction identifier. The events of one run are
    then easy to find, and two runs cannot mix.
    """
    try:
        await adk_runtime.run_workflow(
            build_phase1_workflow(),
            f"Catalogue {request.repo_url}",
            user_id=request.user_id,
            session_id=tx_id,
            state={
                "tx_id": tx_id,
                "repo_url": request.repo_url,
                "user_id": request.user_id,
                "commit_sha": request.commit_sha,
            },
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


@router.post("/trigger-sync")
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

    background.add_task(_run_phase1, request, tx_id)
    return {"transaction_id": tx_id, "status": TransactionStatus.RUNNING.value}


@router.get("/transactions/{tx_id}")
def get_transaction(tx_id: str) -> Transaction:
    """Give the state of one transaction. The client polls this endpoint."""
    transaction = store.get_transaction(tx_id)
    if transaction is None:
        raise HTTPException(status_code=404, detail=f"No transaction {tx_id}.")
    return transaction
