"""Tests that need no network and no model call.

These tests do the work of the first smoke test. They prove that the graph is
correct, that the model pin holds, that the filters of the scan work, and that no
instruction has a template field that the engine cannot resolve.
"""

from __future__ import annotations

import re
import subprocess
import sys
from itertools import pairwise

import pytest
from google.adk.utils.instructions_utils import _is_valid_state_name
from google.adk.workflow import START, Edge, FunctionNode
from pydantic import ValidationError

import config
from graph import build_phase1_workflow
from models import ExtractedMetadata, TransactionStatus
from nodes import evaluator, extraction, generator, scanner, style_rules
from sync import github as github_sync

EXPECTED_ORDER = [
    "scan_github_repository",
    "extraction_agent",
    "attach_style_rules",
    "asset_generator_agent",
    "path_evaluator_agent",
    "persist_transaction",
]


# --------------------------------------------------------------------------
# The graph
# --------------------------------------------------------------------------


def test_the_graph_builds_and_the_nodes_are_in_order():
    """The graph has six nodes, and each node joins to the next one."""
    workflow = build_phase1_workflow()

    assert workflow.name == "projectsync_phase1"
    assert len(workflow.edges) == len(EXPECTED_ORDER)

    assert workflow.edges[0].from_node is START
    assert workflow.edges[0].to_node.name == EXPECTED_ORDER[0]

    # `pairwise` gives each node with the node after it. The `zip` then compares
    # two sequences of the same length, so `strict=True` there catches an edge
    # that is absent.
    for edge, (first, second) in zip(
        workflow.edges[1:], pairwise(EXPECTED_ORDER), strict=True
    ):
        assert edge.from_node.name == first
        assert edge.to_node.name == second


def test_the_factory_gives_new_nodes_on_each_call():
    """Two calls give two sets of node objects.

    A `Workflow` at module level can bind the same node two times if a second
    import happens. A factory function stops that.
    """
    first = build_phase1_workflow()
    second = build_phase1_workflow()

    assert first is not second
    assert first.edges[1].from_node is not second.edges[1].from_node


def test_start_is_a_node_and_not_a_string():
    """`START` is an object, and a string in an edge raises an error.

    Some documents say to write `Edge(from_node="START", ...)`. That code does not
    run. `Edge.from_node` is typed `BaseNode`, so a string fails validation.

    The test names `ValidationError` and not `Exception`. `Edge` is a Pydantic
    model, so a wrong type must fail at validation. A test that accepts any error
    would also pass on an import error or a name error, and then it proves nothing.
    """
    assert START != "START"
    assert START.name == "__START__"

    with pytest.raises(ValidationError):
        Edge(from_node="START", to_node="scan_github_repository")


def test_the_code_nodes_have_the_default_parameter_binding():
    """The default binding is `"state"`, and each code node keeps it.

    In `"state"` mode a parameter with the name `node_input` gets the output of the
    node before it, and each other parameter comes from the state by its name.
    `"node_input"` mode takes the parameters out of the payload one by one, for a
    node that works as a tool of an agent.
    """
    workflow = build_phase1_workflow()
    code_nodes = [
        edge.to_node
        for edge in workflow.edges
        if isinstance(edge.to_node, FunctionNode)
    ]

    assert len(code_nodes) == 3
    for node in code_nodes:
        assert node.parameter_binding == "state"


def test_the_scan_node_does_not_take_a_node_input_parameter():
    """The first node must read the state, and not the input of the edge.

    The START node gives user content of the type `types.Content`. That type does
    not change into a Pydantic model, so a parameter with the name `node_input` on
    the first node fails.
    """
    names = scanner.scan_github_repository.__code__.co_varnames
    assert "node_input" not in names
    assert "repo_url" in names


# --------------------------------------------------------------------------
# The instructions
# --------------------------------------------------------------------------

_BRACE_TOKEN = re.compile(r"{+[^{}]*}+")

ALL_INSTRUCTIONS = {
    "extraction": extraction.INSTRUCTION,
    "generator": generator.INSTRUCTION,
    "evaluator": evaluator.INSTRUCTION,
}


@pytest.mark.parametrize("name", sorted(ALL_INSTRUCTIONS))
def test_no_instruction_has_a_template_field_that_cannot_resolve(name):
    """Guard the largest silent failure of the project.

    The template engine of the framework accepts only a name that is a valid
    Python identifier, or a name with the prefix `app:`, `user:`, or `temp:`. A
    name with a dot in it, such as `{AssetGenInput.style_rules}`, is not an
    identifier. The engine leaves that text as it is, so the model reads the
    braces and the style rules have no effect. Nothing raises an error.

    This test calls the same function that the engine calls.
    """
    for token in _BRACE_TOKEN.findall(ALL_INSTRUCTIONS[name]):
        var_name = token.strip("{}").strip().removesuffix("?")
        assert _is_valid_state_name(var_name), (
            f"The instruction of {name} holds {token!r}. The engine cannot resolve "
            f"that name, so it stays in the prompt as the same characters. Give the "
            f"data as the input of the node instead."
        )


def test_the_generator_instruction_names_the_style_rules_key():
    """The generator must tell the model where the rules are in its input.

    The rules come in the JSON of the message, under the key `style_rules`.
    """
    assert "style_rules" in generator.INSTRUCTION
    assert "Obey every line" in generator.INSTRUCTION


# --------------------------------------------------------------------------
# The model pin
# --------------------------------------------------------------------------


def test_the_model_is_at_or_above_the_mandated_floor():
    """The rules of the hackathon give a floor of Gemini 3.5.

    Stage One of the judging is pass or fail, so a model below the floor removes
    the entry.
    """
    assert config.MODEL.startswith(config._PERMITTED_PREFIXES)


def test_a_model_below_the_floor_stops_the_import():
    """A wrong `MODEL_ID` must fail at import, and not at the first request.

    The test runs a new interpreter, because `config` is already imported in this
    one.
    """
    result = subprocess.run(
        [sys.executable, "-c", "import config"],
        env={
            "MODEL_ID": "gemini-3-flash",
            "PATH": "",
            "SYSTEMROOT": "C:\\Windows",
            "PYTHONPATH": str(__import__("pathlib").Path(__file__).resolve().parent.parent),
        },
        capture_output=True,
        text=True,
        # The failure is what the test looks for, so `check` must stay off. With
        # `check=True` the call raises and the two asserts below never run.
        check=False,
    )
    assert result.returncode != 0
    assert "below the mandated Gemini 3.5 floor" in result.stderr


# --------------------------------------------------------------------------
# The scan
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("https://github.com/owner/name", "owner/name"),
        ("https://github.com/owner/name/", "owner/name"),
        ("https://github.com/owner/name.git", "owner/name"),
        # A deep URL ends with a branch, so the parser must read from the front.
        ("https://github.com/owner/name/tree/main", "owner/name"),
        ("git@github.com:owner/name.git", "owner/name"),
        ("owner/name", "owner/name"),
    ],
)
def test_parse_repo_url(url, expected):
    """The parser accepts the forms of a URL that a person pastes."""
    assert scanner.parse_repo_url(url) == expected


@pytest.mark.parametrize(
    "url", ["https://github.com/", "https://github.com", "owner", ""]
)
def test_parse_repo_url_rejects_a_url_with_no_owner(url):
    """A text with less than two parts is not a repository."""
    with pytest.raises(scanner.ScanError):
        scanner.parse_repo_url(url)


@pytest.mark.parametrize(
    ("path", "size", "keep"),
    [
        ("README.md", 2_000, True),
        ("src/main.py", 4_000, True),
        ("node_modules/left-pad/index.js", 100, False),
        (".venv/lib/site-packages/thing.py", 100, False),
        ("assets/logo.png", 500, False),
        ("uv.lock", 900, False),
        ("src/huge.py", 400_000, False),
    ],
)
def test_is_relevant_file(path, size, keep):
    """The filter runs before the request to the model, and not after it.

    A large repository can fill all of the context window with dependency code.
    """
    assert scanner.is_relevant_file(path, size) is keep


# --------------------------------------------------------------------------
# The style rules
# --------------------------------------------------------------------------


class _FakeContext:
    """A small stand-in for `Context`. It holds only the state."""

    def __init__(self, state: dict | None = None):
        self.state = state or {}


def _metadata() -> ExtractedMetadata:
    """Give one small metadata object for a test."""
    return ExtractedMetadata(
        project_name="ProjectSync",
        tagline="Turns a finished repository into career assets.",
        problem_solved="A finished project has no documentation.",
        tech_stack=["Python", "FastAPI"],
    )


def test_attach_style_rules_puts_the_rules_in_the_payload(monkeypatch):
    """The rules go into the input of the generator, and the ids go into the state."""
    from models import RuleState, StyleRule

    rules = [
        StyleRule(rule_id="r1", text="Do not use an em dash.", state=RuleState.ACTIVE),
        StyleRule(rule_id="r2", text="Do not open with Excited to share.", state=RuleState.ACTIVE),
    ]
    monkeypatch.setattr(style_rules.store, "active_style_rules", lambda user_id: rules)

    ctx = _FakeContext({"user_id": "u1"})
    payload = style_rules.attach_style_rules(ctx=ctx, node_input=_metadata())

    assert payload.style_rules == [rule.text for rule in rules]
    assert payload.style_rule_ids == ["r1", "r2"]
    assert ctx.state["style_rule_ids"] == ["r1", "r2"]


def test_the_rules_reach_the_model_in_the_json_of_the_message(monkeypatch):
    """The framework sends the input of a node as JSON, so the rules are in it.

    This test proves the path that replaces the template field. `to_user_content`
    calls `model_dump_json()` on a Pydantic model and appends the result as a user
    event.
    """
    from google.adk.utils.content_utils import to_user_content

    from models import RuleState, StyleRule

    rule_text = "Never write the word synergy."
    monkeypatch.setattr(
        style_rules.store,
        "active_style_rules",
        lambda user_id: [StyleRule(rule_id="r1", text=rule_text, state=RuleState.ACTIVE)],
    )

    payload = style_rules.attach_style_rules(ctx=_FakeContext(), node_input=_metadata())
    content = to_user_content(payload)

    assert content.role == "user"
    assert rule_text in content.parts[0].text


def test_a_failure_of_the_rule_store_does_not_stop_the_run(monkeypatch):
    """Assets with no style rule are still useful.

    A read that fails writes a warning and gives an empty list. The run continues.
    """

    def _explode(user_id):
        raise RuntimeError("Firestore is not reachable.")

    monkeypatch.setattr(style_rules.store, "active_style_rules", _explode)

    payload = style_rules.attach_style_rules(ctx=_FakeContext(), node_input=_metadata())

    assert payload.style_rules == []
    assert payload.metadata.project_name == "ProjectSync"


# --------------------------------------------------------------------------
# The commits
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("ProjectSync", "projectsync"),
        ("My Cool App!", "my-cool-app"),
        ("  spaced  out  ", "spaced-out"),
        ("!!!", "project"),
    ],
)
def test_slugify(name, expected):
    """The file name of an asset must be safe in a Git path."""
    assert github_sync.slugify(name) == expected


def test_a_partial_commit_is_not_completed():
    """A row with one commit must not read as COMPLETED.

    The two commits are independent, so the status `PARTIAL` exists for the case
    that one lands and the other fails.
    """
    assert TransactionStatus.PARTIAL != TransactionStatus.COMPLETED
    assert "PARTIAL" in {status.value for status in TransactionStatus}
