"""The asset generator agent. This node makes all four assets in one pass.

One model with four fields. Four separate requests cost more, and they can
disagree with each other about the same project.

This instruction holds no template field, and that is deliberate. An agent node
gets the output of the node before it as the message of the user. The framework
turns a Pydantic model into JSON with `model_dump_json()` and appends it as a
user event, so the whole `AssetGenInput` reaches the model. The style rules are
inside that JSON.

Do not put `{AssetGenInput.style_rules}` in this instruction. The template engine
accepts only a name that is a valid Python identifier, or a name with the prefix
`app:`, `user:`, or `temp:`. A name with a dot in it is not an identifier, so the
engine leaves the text as it is and the model reads the braces. The rules then
have no effect, and nothing raises an error. A silent failure of the memory is
worse than a crash.
"""

from __future__ import annotations

from google.adk import Agent
from google.adk.workflow import RetryConfig
from google.genai import types as genai_types

import config
from models import GeneratedAssets

INSTRUCTION = """\
You write career assets from the facts of one software project.

The message holds one JSON object with three keys:

- `metadata` — the facts of the project. It has `project_name`, `tagline`,
  `problem_solved`, `tech_stack`, `key_features`, `architecture_summary`, and
  `completeness_notes`.
- `style_rules` — a list of lines. Each line is an instruction about how this
  person writes. Obey every line.
- `style_rule_ids` — identifiers for the record. Ignore them.

Write these four assets:

1. `doc_sheet_md` — a documentation sheet in markdown. Start with a YAML block
   that holds the title, the stack, and the date. Then write these parts: what
   the project does, how it is built, and how to run it.
2. `portfolio_card` — a JSON object with these keys: `title`, `tagline`,
   `stack`, `highlights`, and `repo_url`.
3. `resume_bullets` — three or four lines. Each line starts with a verb. Name
   the technical constraint, and not only the result.
4. `social_draft` — one post. Write it in the voice of the person, from the
   rules in `style_rules`.

Rules for all four assets:
- Use only the facts in `metadata`. Do not add a fact.
- If a rule in `style_rules` and a habit of yours do not agree, obey the rule.
- If `style_rules` is empty, write in a plain and direct voice.
- Do not write "Excited to share" unless a rule asks for it.
"""


def build_asset_generator_agent() -> Agent:
    """Make the asset generator agent.

    A factory function builds the node. A node at module level can bind two times
    if a second import happens.
    """
    return Agent(
        name="asset_generator_agent",
        description="Writes four career assets from the metadata and the style rules.",
        model=config.MODEL,
        instruction=INSTRUCTION,
        output_schema=GeneratedAssets,
        # The last code node needs the four assets. The evaluator node between
        # them gives only the recommendation, so the assets go through the state.
        output_key="generated_assets",
        # The specification asks for one retry. On the second failure the
        # transaction becomes FAILED_GENERATION.
        retry_config=RetryConfig(max_attempts=2, initial_delay=2.0),
        timeout=180.0,
        # The assets must read well, so the temperature is higher than the
        # temperature of the extraction node. It is not 0.0, because a draft with
        # no variation reads like a form.
        generate_content_config=genai_types.GenerateContentConfig(temperature=0.7),
    )
