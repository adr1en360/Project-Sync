"""The persist node. This node is plain Python and is the last node of Phase 1.

The node writes the full transaction to Firestore with the status
`PENDING_APPROVAL`, and then Phase 1 ends. Phase 1 does not wait for a person.

This write is the durable line between Phase 1 and Phase 2. Cloud Run goes to
zero instances between the two phases, so the state must be in Firestore and not
in the memory of a process.
"""

from __future__ import annotations

import logging

from google.adk import Context

import store
from models import (
    AssetSource,
    AssetVersion,
    ExtractedMetadata,
    GeneratedAssets,
    PathRecommendation,
    Transaction,
    TransactionStatus,
)

logger = logging.getLogger(__name__)


def persist_transaction(ctx: Context, node_input: PathRecommendation) -> Transaction:
    """Write the full transaction row and give it back.

    The parameter `node_input` gets the recommendation from the evaluator agent.
    The metadata and the four assets come from `ctx.state`, because the two agent
    nodes have an `output_key` and the graph wrapper copies their output there.

    Args:
      ctx: The context of the run. The state holds the other parts of the row.
      node_input: The recommendation from the path evaluator agent.

    Returns:
      The `Transaction` that this function wrote.
    """
    tx_id = ctx.state.get("tx_id") or store.new_id()

    metadata_raw = ctx.state.get("extracted_metadata")
    assets_raw = ctx.state.get("generated_assets")
    style_rule_ids = list(ctx.state.get("style_rule_ids", []))

    # Make the first asset version. The list is append-only. The persist node
    # writes the GENERATED version, and Phase 2 adds a HUMAN_EDITED or a
    # REGENERATED version later. If the generator gave no assets, the list stays
    # empty, because a missing part must not stop the write of the row.
    assets_model = _as_model(assets_raw, GeneratedAssets)
    asset_versions: list[AssetVersion] = []
    if assets_model is not None:
        asset_versions.append(
            AssetVersion(
                assets=assets_model,
                source=AssetSource.GENERATED,
                created_at=store.now_iso(),
                style_rules_applied=style_rule_ids,
            )
        )

    transaction = Transaction(
        tx_id=tx_id,
        user_id=ctx.state.get("user_id", "default"),
        repo_url=ctx.state.get("repo_url", ""),
        repo_name=ctx.state.get("repo_name", ""),
        status=TransactionStatus.PENDING_APPROVAL,
        metadata=_as_model(metadata_raw, ExtractedMetadata),
        asset_versions=asset_versions,
        recommendation=node_input,
        style_rules_applied=style_rule_ids,
        approval_token=store.new_id(),
        created_at=store.now_iso(),
    )

    store.save_transaction(transaction)
    logger.info(
        "The transaction %s is PENDING_APPROVAL with %d style rules.",
        tx_id,
        len(transaction.style_rules_applied),
    )
    return transaction


def _as_model(raw: object, model: type) -> object | None:
    """Change a value from the state into a model.

    The framework puts a dictionary in the state, because it changes the model
    that a node returns into JSON. This function changes it back. The function
    gives `None` if the value is absent or does not fit the model, because a
    missing part must not stop the write of the row.
    """
    if raw is None:
        return None
    if isinstance(raw, model):
        return raw
    try:
        return model.model_validate(raw)
    except Exception as error:  # noqa: BLE001 - keep the row, and log the problem.
        logger.warning("The state value does not fit %s: %s", model.__name__, error)
        return None
