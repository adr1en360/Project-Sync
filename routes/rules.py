"""The style rules: read them, write one by hand, change the state of one, delete one.

A rule starts as `PROPOSED` and does nothing. A person must click one time to make
a rule `ACTIVE`. A rule that a person dismisses becomes `INACTIVE` but stays in the
database, because the person can make it active again later.

A person can also delete a rule. That rule becomes `DELETED` and the list of rules
does not show it again. The document stays in the database for the receipt of each
past run.

The rules are read new on every generation. So a change here takes effect on the
next generation, and there is no new deploy and no restart.
"""

from __future__ import annotations

from fastapi import APIRouter

import store
from models import NewRuleRequest, RuleSource, RuleState, RuleStateRequest

router = APIRouter(prefix="/api/v1", tags=["style rules"])


@router.get("/rules")
def list_rules(user_id: str = "default") -> list:
    """Give the rules of one person that the interface shows.

    A rule that the person deleted is not in the list.
    """
    return [rule.model_dump(mode="json") for rule in store.all_style_rules(user_id)]


@router.post("/rules")
def create_rule(request: NewRuleRequest) -> dict:
    """Write one rule by hand. The new rule is `PROPOSED`, like every other rule."""
    rule = store.write_style_rule(
        user_id=request.user_id, text=request.text, source=RuleSource.USER
    )
    return rule.model_dump(mode="json")


@router.post("/rules/{rule_id}")
def toggle_rule(rule_id: str, request: RuleStateRequest) -> dict:
    """Change one rule to ACTIVE, INACTIVE, or PROPOSED.

    The rules are read new on every run, so this change takes effect on the next
    generation. There is no new deploy and no restart.
    """
    store.set_rule_state(rule_id, request.state)
    return {"rule_id": rule_id, "state": request.state.value}


@router.delete("/rules/{rule_id}")
def delete_rule(rule_id: str) -> dict:
    """Take one rule off the list of rules.

    The state becomes `DELETED` and the document stays in the database. This
    action is not the toggle above. The toggle turns a rule off and the list
    still shows it. This action hides the rule from the list.
    """
    store.delete_style_rule(rule_id)
    return {"rule_id": rule_id, "state": RuleState.DELETED.value}
