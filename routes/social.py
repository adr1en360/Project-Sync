"""Social Drafts endpoints.

The social drafts collection stores draft social posts tied to transactions.
A draft can be regenerated with different platform/tone/language/custom_prompt
combinations without rescanning the repository.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query
from google.genai import types as genai_types

import adk_runtime
import config
import store
from models import (
    SocialDraft,
    SocialDraftCreateRequest,
    SocialDraftRegenerateRequest,
    SocialDraftUpdateRequest,
    SocialPlatform,
    SocialTone,
    Transaction,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["social"])


async def _generate_social_draft(
    transaction: Transaction,
    platform: SocialPlatform,
    tone: SocialTone,
    language: str,
    custom_prompt: str,
) -> str:
    """Write one social post from the facts of a transaction and the style rules.

    The Social Studio makes a post for a different platform, tone, or language,
    and it does not scan the repository again. The facts come from the saved
    transaction. The voice comes from the ACTIVE style rules of the person, the
    same rules that the core generator obeys, so a new post keeps the voice of
    the first draft.
    """
    from google.adk.agents import LlmAgent

    assets = transaction.assets
    metadata = transaction.metadata

    if not assets or not metadata:
        return "No assets or metadata available for generation."

    # The voice of the person lives in the ACTIVE style rules. The core generator
    # obeys them, and this surface must obey them too, or a new post loses the
    # voice that the first draft had. A failure to read the rules must not stop
    # the draft.
    try:
        rules = store.active_style_rules(transaction.user_id)
    except Exception:
        # A rule read failure must not stop the draft. The `exc_info` flag puts the
        # cause in the log, which is why this broad catch needs no `noqa`.
        logger.warning("The read of the style rules failed for a social draft.", exc_info=True)
        rules = []
    style_lines = "\n".join(f"- {rule.text}" for rule in rules) or "None"

    prompt = f"""Write a {platform.value} post about this project.

Project: {metadata.project_name}
Tagline: {metadata.tagline}
Problem solved: {metadata.problem_solved}
Tech stack: {", ".join(metadata.tech_stack)}
Key features: {", ".join(metadata.key_features)}

Existing social draft: {assets.social_draft or "None"}

Style rules (obey every line):
{style_lines}

Tone: {tone.value}
Language: {language}
Custom instruction: {custom_prompt or "None"}

Write a single post optimized for {platform.value} in a {tone.value.lower()} tone.
No hashtags unless platform-appropriate. No markdown formatting."""

    agent = LlmAgent(
        name="social_generator",
        model=config.MODEL,
        instruction="You write social media posts for software projects.",
        generate_content_config=genai_types.GenerateContentConfig(
            thinking_config=genai_types.ThinkingConfig(thinking_budget=0),
        ),
    )
    # One run loop lives in `adk_runtime`. This surface uses it too, so a
    # correction to the loop reaches every caller and no fifth copy drifts.
    return await adk_runtime.run_agent_for_text(
        agent,
        prompt,
        user_id=transaction.user_id,
        session_id=f"social_{transaction.tx_id}",
    )


@router.post("/social-drafts")
async def create_social_draft(request: SocialDraftCreateRequest) -> dict:
    """Create a new social draft, generating it from the transaction."""
    transaction = store.get_transaction(request.tx_id)
    if transaction is None:
        raise HTTPException(status_code=404, detail="No such transaction.")

    # Generate the draft
    text = await _generate_social_draft(
        transaction,
        request.platform,
        request.tone,
        request.language,
        request.custom_prompt,
    )

    draft_id = store.new_id()
    draft = SocialDraft(
        draft_id=draft_id,
        user_id=request.user_id,
        tx_id=request.tx_id,
        platform=request.platform,
        tone=request.tone,
        language=request.language,
        custom_prompt=request.custom_prompt,
        text=text,
        is_manual_edit=False,
        created_at=store.now_iso(),
    )
    store.save_social_draft(draft)
    return draft.model_dump(mode="json")


@router.get("/social-drafts")
async def list_social_drafts(
    user_id: str = Query("default"),
    tx_id: str | None = Query(None),
    platform: SocialPlatform | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> list[dict]:
    """List social drafts for a user with optional filters."""
    drafts = store.list_social_drafts(
        user_id=user_id,
        tx_id=tx_id,
        platform=platform,
        limit=limit,
        offset=offset,
    )
    return [d.model_dump(mode="json") for d in drafts]


@router.get("/social-drafts/{draft_id}")
async def get_social_draft(draft_id: str) -> dict:
    """Get a single social draft by ID."""
    draft = store.get_social_draft(draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="No such draft.")
    return draft.model_dump(mode="json")


@router.patch("/social-drafts/{draft_id}")
async def update_social_draft(draft_id: str, request: SocialDraftUpdateRequest) -> dict:
    """Update a social draft."""
    draft = store.get_social_draft(draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="No such draft.")

    update_fields = {}
    if request.text is not None:
        update_fields["text"] = request.text
        update_fields["is_manual_edit"] = True
    if request.platform is not None:
        update_fields["platform"] = request.platform.value
    if request.tone is not None:
        update_fields["tone"] = request.tone.value
    if request.language is not None:
        update_fields["language"] = request.language
    if request.custom_prompt is not None:
        update_fields["custom_prompt"] = request.custom_prompt

    if update_fields:
        store.update_social_draft(draft_id, **update_fields)

    updated = store.get_social_draft(draft_id)
    return updated.model_dump(mode="json")


@router.delete("/social-drafts/{draft_id}")
async def delete_social_draft(draft_id: str) -> dict:
    """Delete a social draft."""
    draft = store.get_social_draft(draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="No such draft.")
    store.delete_social_draft(draft_id)
    return {"status": "deleted", "draft_id": draft_id}


@router.post("/social-drafts/regenerate")
async def regenerate_social_draft(request: SocialDraftRegenerateRequest) -> dict:
    """Regenerate a social draft with new parameters."""
    draft = store.get_social_draft(request.draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="No such draft.")

    transaction = store.get_transaction(draft.tx_id)
    if transaction is None:
        raise HTTPException(status_code=404, detail="Source transaction not found.")

    # Use new parameters or fall back to existing ones
    platform = request.platform or draft.platform
    tone = request.tone or draft.tone
    language = request.language or draft.language
    custom_prompt = (
        request.custom_prompt if request.custom_prompt is not None else draft.custom_prompt
    )

    # Regenerate
    text = await _generate_social_draft(
        transaction,
        platform,
        tone,
        language,
        custom_prompt,
    )

    store.update_social_draft(
        request.draft_id,
        text=text,
        platform=platform.value,
        tone=tone.value,
        language=language,
        custom_prompt=custom_prompt,
        is_manual_edit=False,
    )

    updated = store.get_social_draft(request.draft_id)
    return updated.model_dump(mode="json")