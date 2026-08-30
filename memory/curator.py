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

import adk_runtime
import config
import store
from models import AssetSource, RuleSource, StyleRule

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
        generate_content_config=genai_types.GenerateContentConfig(
            temperature=0.1,
            thinking_config=genai_types.ThinkingConfig(thinking_budget=0),
        ),
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

    # Build before/after edit pairs from asset_versions. We only include
    # transactions where the person actually edited (HUMAN_EDITED version exists).
    edit_pairs = []
    for row in rows:
        if not row.asset_versions:
            continue
        # Find the first HUMAN_EDITED version and pair it with the version before it
        for i, version in enumerate(row.asset_versions):
            if version.source == AssetSource.HUMAN_EDITED and i > 0:
                before = row.asset_versions[i - 1].assets
                after = version.assets
                edit_pairs.append(
                    {
                        "project": row.repo_name,
                        "before": {
                            "social_draft": before.social_draft,
                            "resume_bullets": before.resume_bullets,
                            "doc_sheet_md": before.doc_sheet_md,
                            "portfolio_card": before.portfolio_card.model_dump(mode="json"),
                        },
                        "after": {
                            "social_draft": after.social_draft,
                            "resume_bullets": after.resume_bullets,
                            "doc_sheet_md": after.doc_sheet_md,
                            "portfolio_card": after.portfolio_card.model_dump(mode="json"),
                        },
                        "rules_that_were_active": row.style_rules_applied,
                    }
                )
                break  # Only the first human edit per transaction

    # If there are no edits, fall back to the old format so we can still detect
    # the "no edit streak" for default rule proposal
    if not edit_pairs:
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

    return (
        f"The rules that this person already has:\n{json.dumps(existing, indent=2)}\n\n"
        f"The edits this person made (before → after):\n{json.dumps(edit_pairs, indent=2)}"
    )


def _count_edit_streak(user_id: str) -> dict[str, int]:
    """Count trailing approvals with no HUMAN_EDITED version for each output type.

    Returns a dict mapping output type to the streak count.
    """
    rows = store.recent_completed_transactions(user_id, limit=10)
    streaks = {
        "social_draft": 0,
        "resume_bullets": 0,
        "doc_sheet_md": 0,
        "portfolio_card": 0,
    }

    for row in rows:
        if not row.asset_versions:
            continue
        # Check if there's any HUMAN_EDITED version
        has_human_edit = any(v.source == AssetSource.HUMAN_EDITED for v in row.asset_versions)
        if not has_human_edit:
            # No human edit — increment all streaks
            for k in streaks:
                streaks[k] += 1
        else:
            # There was a human edit — reset streaks for the fields that were edited
            for version in row.asset_versions:
                if version.source == AssetSource.HUMAN_EDITED:
                    before = None
                    for v in row.asset_versions:
                        if v is version:
                            break
                        before = v.assets
                    if before:
                        after = version.assets
                        if before.social_draft != after.social_draft:
                            streaks["social_draft"] = 0
                        if before.resume_bullets != after.resume_bullets:
                            streaks["resume_bullets"] = 0
                        if before.doc_sheet_md != after.doc_sheet_md:
                            streaks["doc_sheet_md"] = 0
                        if before.portfolio_card != after.portfolio_card:
                            streaks["portfolio_card"] = 0
                    break

    return streaks


def _maybe_propose_defaults(user_id: str, transaction_id: str) -> list[str]:
    """Check streaks and propose default rules if any hit the threshold."""
    streaks = _count_edit_streak(user_id)
    proposed = []
    for output_type, count in streaks.items():
        if count >= ZERO_EDIT_STREAK_FOR_DEFAULT:
            # Propose a rule that locks the current default for this output type
            proposed.append(f"Default {output_type}: keep the current format as-is.")
    if proposed:
        # Save as curator-proposed rules
        saved = save_proposed_rules(user_id, proposed, transaction_id)
        return [rule.text for rule in saved]
    return []


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


async def _run_curator(user_id: str, transaction_id: str) -> list[str]:
    """Look for a style pattern in past approvals, and propose a rule.

    Every rule that this step writes is `PROPOSED`. A person must click one time
    to make a rule `ACTIVE`.

    The function gives an empty list if the person has too few completed rows. Two
    rows are the minimum, because one project is not a pattern.
    """
    prompt = build_curator_prompt(user_id)
    if prompt is None:
        return []

    text = await adk_runtime.run_agent_for_text(
        build_rule_curator_agent(),
        prompt,
        user_id=user_id,
        session_id=f"curator-{store.new_id()}",
    )

    if not text.strip():
        return []
    proposed = ProposedRules.model_validate_json(text)
    saved = save_proposed_rules(user_id, proposed.rules, transaction_id)
    return [rule.text for rule in saved]


async def run_curator_with_defaults(user_id: str, transaction_id: str) -> list[str]:
    """Run the curator and also check for default rule proposals.

    This wraps the normal curator flow and adds the ZERO_EDIT_STREAK_FOR_DEFAULT
    logic.
    """
    proposed = await _run_curator(user_id, transaction_id)
    default_proposed = _maybe_propose_defaults(user_id, transaction_id)
    return proposed + default_proposed
