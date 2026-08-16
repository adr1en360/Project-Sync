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

from google.adk import Agent
from google.adk.workflow import RetryConfig
from google.genai import types as genai_types

import config
from models import PathRecommendation

INSTRUCTION = """\
You decide if a software project is ready to go on a public portfolio.

"Ready" does not mean that the code runs. It means that the repository is safe to
show to a stranger. Look for these things:

- A real README. One line is not a README.
- A test folder, or test files.
- A licence file.
- No secret, no key, and no token in the files.
- No unfinished note, such as TODO or FIXME, in a main file.

Give `FULL_PUBLISH` only if the repository has a real README, has tests, and has
a licence. If one of the three is absent, give `PRIVATE_ONLY`.

Put every reason in `reasons`. Put each thing that the repository must add in
`missing_elements`. Be exact: write "the README is one line", and not "the
documentation is weak".

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
