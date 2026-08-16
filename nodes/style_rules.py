"""The style-rule node. This node is plain Python and makes no model request.

This node is the answer to the largest failure mode of the project. A language
model must never copy a list of rules forward, because a model can change the
words or drop a rule. Code moves the rules instead.

The node gives the generator one typed model. The framework turns that model into
JSON and appends it as the message of the user, so the generator reads every rule
from its own input. The instruction of the generator holds no template field.

Do not put `{AssetGenInput.style_rules}` in the instruction of the generator. The
template engine accepts only a name that is a valid Python identifier, so a name
with a dot in it stays in the prompt as the same characters. The model then never
sees a rule, and every visible part of the system still works: the rules save,
show, and change state correctly. The feature becomes a demonstration of itself.
`tests/test_nodes.py` has a test that guards this.
"""

from __future__ import annotations

import logging

from google.adk import Context

import store
from models import AssetGenInput, ExtractedMetadata

logger = logging.getLogger(__name__)


def attach_style_rules(ctx: Context, node_input: ExtractedMetadata) -> AssetGenInput:
    """Read the ACTIVE rules of the person and put them with the metadata.

    The parameter `node_input` gets the output of the extraction agent. The
    parameter `user_id` comes from `ctx.state`, because the scan node put it
    there. The output of an agent node does not carry the identifier forward.

    Firestore gives the rules live on every run. There is no cache. So a person
    who turns a rule on or off changes the next generation, with no new deploy
    and no restart.

    A failure to read the rules must not stop the run. Assets with no style rule
    are still useful. The node writes a warning and continues with an empty list.

    Args:
      ctx: The context of the run. The state holds `user_id`.
      node_input: The metadata from the extraction agent.

    Returns:
      An `AssetGenInput` with the metadata, the text of each rule, and the
      identifier of each rule.
    """
    user_id = ctx.state.get("user_id", "default")

    try:
        rules = store.active_style_rules(user_id)
    except Exception as error:  # noqa: BLE001 - a rule failure must not stop the run.
        logger.warning("The read of the style rules failed: %s", error)
        rules = []

    # The transaction row keeps the identifiers. A person can then see which
    # rules made one draft. This list is the audit trail of the memory system.
    ctx.state["style_rule_ids"] = [rule.rule_id for rule in rules]

    return AssetGenInput(
        metadata=node_input,
        style_rules=[rule.text for rule in rules],
        style_rule_ids=[rule.rule_id for rule in rules],
    )
