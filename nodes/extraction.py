"""The extraction agent. This node is the first agent in the graph.

The node has an `output_schema`, so it cannot call a tool. This is correct here,
because the scan node before it already read the repository.

An agent node does not bind a typed parameter. It gets the `Event.output` of the
node before it as user content. So this agent reads the `RepoScan` as the message
of the user, and the instruction below does not name a template field.
"""

from __future__ import annotations

from google.adk import Agent
from google.adk.workflow import RetryConfig
from google.genai import types as genai_types

import config
from models import ExtractedMetadata

INSTRUCTION = """\
You read the scan of one GitHub repository. The scan is in the message.

Find the technical facts of the project and give them in the output schema.

Rules:
- Write only a fact that the files show. Do not guess.
- If the scan does not show a fact, leave the field empty.
- Keep `tagline` to one sentence of 20 words or less.
- Set `has_readme` to true if the scan has README text. Set `has_tests` and
  `has_license` to the values that the scan gives.
- Put each thing that the repository does not have into `completeness_notes`.
  Examples are a missing README, no test folder, and no licence file. The next
  agent reads these three fields, with this list, to decide if the work is safe
  to publish.
- Do not praise the project. Do not add a word about quality.
"""


def build_extraction_agent() -> Agent:
    """Make the extraction agent.

    A factory function builds each node. A node at module level can bind two
    times if a second import happens, and then the graph holds the same node
    twice.
    """
    return Agent(
        name="extraction_agent",
        description="Reads a repository scan and gives structured metadata.",
        model=config.MODEL,
        instruction=INSTRUCTION,
        output_schema=ExtractedMetadata,
        # The graph wrapper of an agent node copies the output into the state
        # under this key. The last code node needs the metadata, and the node
        # before it gives only the recommendation.
        output_key="extracted_metadata",
        # The specification asks for one retry with the same input. On the second
        # failure the transaction becomes FAILED_EXTRACTION.
        retry_config=RetryConfig(max_attempts=2, initial_delay=2.0),
        timeout=300.0,
        generate_content_config=genai_types.GenerateContentConfig(
            temperature=0.2,
            thinking_config=genai_types.ThinkingConfig(thinking_budget=0),
        ),
    )
