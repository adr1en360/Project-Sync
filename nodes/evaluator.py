"""The path evaluator agent. This node decides if the work is safe to publish.

The temperature is 0.0. So the same repository gives the same result every time,
and a judge can run the same test and get the same answer.

The word "complete" here does not mean that the code runs. It means that the
repository is safe to show to a stranger. A repository can run correctly and
still fail this test. This is a different risk from the quality of the code, and
it is the reason that this node stays in the build.

An agent that approves everything is a formatter with more steps.
"""

from __future__ import annotations

import logging

from google.adk import Agent, Context
from google.adk.workflow import RetryConfig
from google.genai import types as genai_types

import config
from models import ExtractedMetadata, GeneratedAssets, PathRecommendation

logger = logging.getLogger(__name__)

INSTRUCTION = """\
You decide if a software project is ready to go on a public portfolio.

The message holds the facts of one repository, as JSON. Read these fields:

- `has_readme`, `has_tests`, `has_license` — each is true or false.
- `completeness_notes` — a list of the things that the repository does not have.
- `project_name`, `tagline`, `problem_solved`, and the technical fields — the
  facts that the scan and the extraction agent found.

"Ready" does not mean that the code runs. It means that the repository is safe to
show to a stranger.

Give `FULL_PUBLISH` only if `has_readme`, `has_tests`, and `has_license` are all
true, and `completeness_notes` names no blocker such as a secret in the files. If
one of the three is false, give `PRIVATE_ONLY`.

Put every reason in `reasons`. Put each thing that the repository must add in
`missing_elements`; the lines of `completeness_notes` go here. Be exact: write
"the repository has no licence", and not "the documentation is weak".

`PRIVATE_ONLY` is not a failure. The notes are useful to the person in each case.
The result only says that the work does not go on the public portfolio now.
"""


def build_path_evaluator_agent() -> Agent:
    """Make the path evaluator agent.

    A factory function builds the node. A node at module level can bind two times
    if a second import happens.
    """
    return Agent(
        name="path_evaluator_agent",
        description="Decides between FULL_PUBLISH and PRIVATE_ONLY.",
        model=config.MODEL,
        instruction=INSTRUCTION,
        output_schema=PathRecommendation,
        retry_config=RetryConfig(max_attempts=2, initial_delay=2.0),
        timeout=120.0,
        # The temperature is 0.0 so that the result repeats. A judge must get the
        # same answer from the same commit.
        generate_content_config=genai_types.GenerateContentConfig(temperature=0.0),
    )


def select_evaluator_input(ctx: Context, node_input: GeneratedAssets) -> ExtractedMetadata:
    """Give the path evaluator the facts of the repository, not the draft assets.

    An agent node reads the output of the node before it as its message. The node
    before the evaluator is the generator, so without this node the evaluator
    reads the four draft assets and not the facts of the repository. The evaluator
    must judge the repository: the README, the tests, the licence, and the
    completeness notes. So this node reads the extraction metadata from the state
    and gives it to the evaluator.

    The generator already wrote its assets to the state under `generated_assets`,
    so the assets are safe and the persist node still finds them. This node only
    changes the message that the evaluator reads. It does not use `node_input`.

    Args:
      ctx: The context of the run. The state holds `extracted_metadata`.
      node_input: The four assets from the generator. This node does not use them,
        because the evaluator judges the repository and not the drafts.

    Returns:
      The `ExtractedMetadata` for the evaluator to judge. An empty metadata goes
      back if the state has none, so a missing part does not stop the run.
    """
    raw = ctx.state.get("extracted_metadata")
    if isinstance(raw, ExtractedMetadata):
        return raw
    if raw is not None:
        try:
            return ExtractedMetadata.model_validate(raw)
        except Exception as error:  # noqa: BLE001 - keep the run, and log the problem.
            logger.warning("The evaluator input does not fit ExtractedMetadata: %s", error)
    return ExtractedMetadata(project_name="", tagline="", problem_solved="")
