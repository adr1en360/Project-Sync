"""The test that proves the memory works. It makes a real model call.

The claim of the project is that a style rule changes what the model writes. Every
other test proves that the rules move through the code correctly. Only this test
proves that they reach the model and change the words.

The test does not run by default, because it costs a model call. Turn it on:

    RUN_LIVE_TESTS=1 uv run pytest tests/test_style_rules_change_output.py -v

The test needs `GOOGLE_API_KEY`, or `GOOGLE_GENAI_USE_VERTEXAI=True` with a
project.
"""

from __future__ import annotations

import os

import pytest
from google.adk import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types as genai_types

from models import AssetGenInput, ExtractedMetadata, GeneratedAssets
from nodes.generator import build_asset_generator_agent

pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_LIVE_TESTS") != "1",
    reason="This test makes a real model call. Set RUN_LIVE_TESTS=1 to run it.",
)

BANNED_OPENER = "Excited to share"

RULE = f'Never open a post with "{BANNED_OPENER}". Start with the problem.'


def _metadata() -> ExtractedMetadata:
    """Give the facts of one project. The two runs use the same facts."""
    return ExtractedMetadata(
        project_name="ProjectSync",
        tagline="Turns a finished GitHub repository into career-ready outputs.",
        problem_solved=(
            "A developer finishes a project and then writes the documentation, the "
            "portfolio card, the resume lines, and the post by hand. Most people "
            "stop after the code."
        ),
        tech_stack=["Python", "Google ADK", "FastAPI", "Firestore"],
        key_features=[
            "Reads a repository and finds the technical facts.",
            "Writes four career assets in one pass.",
            "Waits for one approval before it writes to GitHub.",
        ],
        architecture_summary="A six-node graph workflow on Cloud Run.",
    )


async def _generate(payload: AssetGenInput, session_id: str) -> GeneratedAssets:
    """Run the generator agent one time and give the four assets."""
    runner = Runner(
        agent=build_asset_generator_agent(),
        app_name="projectsync-test",
        session_service=InMemorySessionService(),
        auto_create_session=True,
    )

    text = ""
    async for event in runner.run_async(
        user_id="test-user",
        session_id=session_id,
        new_message=genai_types.Content(
            role="user", parts=[genai_types.Part(text=payload.model_dump_json())]
        ),
    ):
        if event.content and event.content.parts and not event.partial:
            text = "".join(
                part.text
                for part in event.content.parts
                if part.text and not part.thought
            )

    assert text.strip(), "The generator gave no text."
    return GeneratedAssets.model_validate_json(text)


@pytest.mark.asyncio
async def test_a_style_rule_changes_the_social_draft():
    """The same facts with one rule give a different post.

    The test runs the generator two times. The first run has no rule. The second
    run has one rule that bans an opening line. The test then compares the two
    posts.

    The test is not exact about the words that the model chooses. It checks two
    things that a rule must control: the banned line is absent, and the two posts
    are not the same text.
    """
    metadata = _metadata()

    without_rule = await _generate(
        AssetGenInput(metadata=metadata, style_rules=[]), "no-rule"
    )
    with_rule = await _generate(
        AssetGenInput(metadata=metadata, style_rules=[RULE], style_rule_ids=["r1"]),
        "with-rule",
    )

    assert BANNED_OPENER.lower() not in with_rule.social_draft.lower(), (
        "The rule banned this opening line, and the model used it. The rule did not "
        "reach the model. Check that the instruction has no template field with a "
        "dot in it."
    )
    assert with_rule.social_draft != without_rule.social_draft, (
        "The two posts are the same text, so the rule changed nothing."
    )

    # Every run must still give all four assets. A rule must not remove one.
    for assets in (without_rule, with_rule):
        assert assets.doc_sheet_md.strip()
        assert assets.portfolio_card
        assert assets.resume_bullets
        assert assets.social_draft.strip()
