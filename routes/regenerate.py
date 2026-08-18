"""Make the four assets again with the style rules that are ACTIVE now.

This endpoint is the reason that a new rule changes the review which is open now,
and not only the next repository. It uses the metadata that Phase 1 already wrote
to Firestore, so it makes no new scan and no new extraction call.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

import adk_runtime
import store
from models import AssetGenInput, AssetSource, AssetVersion, GeneratedAssets, RegenerateRequest
from nodes.generator import build_asset_generator_agent

router = APIRouter(prefix="/api/v1", tags=["regenerate"])


async def _run_generator(payload: AssetGenInput, session_id: str) -> GeneratedAssets:
    """Run only the generator agent on one input, and give the four assets.

    The agent gets the input as the message of the user, in JSON. There is no
    template field in the instruction, because the template engine accepts only a
    name that is a valid Python identifier. A name with a dot in it stays in the
    text as it is, and then the rules have no effect.
    """
    text = await adk_runtime.run_agent_for_text(
        build_asset_generator_agent(),
        payload.model_dump_json(),
        user_id="regenerate",
        session_id=session_id,
    )

    if not text.strip():
        raise HTTPException(status_code=502, detail="The generation gave no output.")
    return GeneratedAssets.model_validate_json(text)


@router.post("/regenerate-asset")
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

    # Append a REGENERATED version instead of overwriting the draft. The previous
    # draft stays in the row, so a person can compare and the curator can see the
    # difference that the new rules made.
    new_version = AssetVersion(
        assets=assets,
        source=AssetSource.REGENERATED,
        created_at=store.now_iso(),
        style_rules_applied=[rule.rule_id for rule in rules],
    )
    versions = [version.model_dump(mode="json") for version in transaction.asset_versions]
    versions.append(new_version.model_dump(mode="json"))

    store.update_transaction(
        request.transaction_id,
        asset_versions=versions,
        style_rules_applied=[rule.rule_id for rule in rules],
    )
    return {
        "transaction_id": request.transaction_id,
        "assets": assets.model_dump(mode="json"),
        "style_rules_applied": [rule.text for rule in rules],
    }
