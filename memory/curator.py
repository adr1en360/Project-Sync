"""The rule curator. It proposes a style rule, and never makes one active.

The curator runs after a person clicks Approve. It is the third step of Phase 2.
It reads the most recent completed rows with a plain Firestore query, ordered by
date. There is no vector search and no semantic index.

Every rule that the curator writes is `PROPOSED`. A person must click one time to
make a rule `ACTIVE`. The reason is that the tone of the user changes between
projects, so a rule from one project must not bind every later project without a
check.

A failure here is not a failure of the run. This step is an extra layer, and not
a part of the core loop.
"""

from __future__ import annotations

import json
import logging

from google.adk import Agent
from google.genai import types as genai_types
from pydantic import BaseModel, Field

import config
import store
from models import RuleSource, StyleRule

logger = logging.getLogger(__name__)

MIN_TRANSACTIONS = 2
"""The curator needs this many completed rows to look for a pattern.

One project is not a pattern. A rule from one project is a guess.
"""

ZERO_EDIT_STREAK_FOR_DEFAULT = 3
"""After this many approvals with no edit, the curator proposes a default."""


class ProposedRules(BaseModel):
    """What the curator agent gives back."""

    rules: list[str] = Field(
        default_factory=list,
        description="Each rule is one short line. Give an empty list if there is "
        "no clear pattern.",
    )
    reasoning: str = ""


INSTRUCTION = """\
You read the record of assets that a person approved for some projects, and the
edits that the person made to them.

Find a pattern in the edits. A pattern is a change that the person made more than
one time, across more than one project.

Write each pattern as one short rule in the voice of an instruction. Examples:
- Do not open a post with "Excited to share".
- Do not use an em dash.
- Name the technical constraint, and not the result.

Rules for your answer:
- Give a rule only if you see the same change in two projects or more.
- If you see no clear pattern, give an empty list. An empty list is a correct
  answer, and a weak guess is not.
- Do not repeat a rule that the person already has.
- Keep each rule under 15 words.
"""


def build_rule_curator_agent() -> Agent:
    """Make the rule curator agent."""
    return Agent(
        name="rule_curator_agent",
        description="Proposes a style rule from the edits of past approvals.",
        model=config.MODEL,
        instruction=INSTRUCTION,
        output_schema=ProposedRules,
        timeout=90.0,
        # A low temperature keeps the curator from the invention of a pattern.
        generate_content_config=genai_types.GenerateContentConfig(temperature=0.1),
    )


def build_curator_prompt(user_id: str) -> str | None:
    """Make the text that the curator reads, or give `None` if there is too little.

    The function gives `None` if the person has fewer than `MIN_TRANSACTIONS`
    completed rows. The caller then skips the curator for this round.
    """
    rows = store.recent_completed_transactions(user_id, limit=10)
    if len(rows) < MIN_TRANSACTIONS:
        logger.info(
            "The curator did not run: %d completed rows, and %d are necessary.",
            len(rows),
            MIN_TRANSACTIONS,
        )
        return None

    existing = [rule.text for rule in store.all_style_rules(user_id)]

    record = []
    for row in rows:
        if not row.assets:
            continue
        record.append(
            {
                "project": row.repo_name,
                "social_draft": row.assets.social_draft,
                "resume_bullets": row.assets.resume_bullets,
                "rules_that_were_active": row.style_rules_applied,
            }
        )

    return (
        f"The rules that this person already has:\n{json.dumps(existing, indent=2)}\n\n"
        f"The assets that this person approved:\n{json.dumps(record, indent=2)}"
    )


def save_proposed_rules(
    user_id: str, texts: list[str], transaction_id: str
) -> list[StyleRule]:
    """Write each new rule in the `PROPOSED` state.

    The function drops a rule that repeats a rule that the person already has.
    """
    existing = {rule.text.strip().lower() for rule in store.all_style_rules(user_id)}
    saved = []
    for text in texts:
        if text.strip().lower() in existing:
            continue
        saved.append(
            store.write_style_rule(
                user_id=user_id,
                text=text.strip(),
                source=RuleSource.CURATOR,
                source_transaction_id=transaction_id,
            )
        )
    return saved
