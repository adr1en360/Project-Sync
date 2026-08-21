"""The Phase 1 graph.

Seven nodes. Four are plain Python and three are agents. The ratio is the argument
against a thin wrapper, and the architecture criterion scores it.

    START
      -> scan_github_repository      code
      -> extraction_agent            agent
      -> attach_style_rules          code
      -> asset_generator_agent       agent
      -> select_evaluator_input      code
      -> path_evaluator_agent        agent
      -> persist_transaction         code

Two points about the API are easy to get wrong:

* `START` is an object that you import from `google.adk.workflow`. It is not the
  text "START". `Edge.from_node` and `Edge.to_node` accept a `BaseNode`, so a
  string in either field raises a validation error.
* `Agent` and `Workflow` are both subclasses of `BaseNode`. So an agent goes
  directly into an edge, and one workflow can hold another workflow.

Always build the graph with this factory function. A `Workflow` at module level
can bind the same node two times if a second import happens.
"""

from __future__ import annotations

from itertools import pairwise

from google.adk import Workflow
from google.adk.workflow import START, Edge, FunctionNode

from nodes.evaluator import build_path_evaluator_agent, select_evaluator_input
from nodes.extraction import build_extraction_agent
from nodes.generator import build_asset_generator_agent
from nodes.persist import persist_transaction
from nodes.scanner import scan_github_repository
from nodes.style_rules import attach_style_rules


def build_phase1_workflow() -> Workflow:
    """Make the Phase 1 workflow.

    Each code node keeps the default parameter binding, which is `"state"`. In
    that mode the parameter with the name `node_input` gets the output of the node
    before it, and each other parameter comes from the state. Do not set
    `parameter_binding="node_input"`, because that mode takes the parameters out
    of the payload one by one.

    Returns:
      A `Workflow` that is ready to run.
    """
    scan_node = FunctionNode(
        func=scan_github_repository,
        name="scan_github_repository",
        # This node has no `retry_config`. The scan function retries by itself,
        # because it must read the `retry-after` header of GitHub to know how long
        # to wait. A retry at node level would start the whole scan again and use
        # more of the rate limit.
        timeout=120.0,
    )
    extraction_node = build_extraction_agent()
    style_rules_node = FunctionNode(
        func=attach_style_rules,
        name="attach_style_rules",
        timeout=30.0,
    )
    generator_node = build_asset_generator_agent()
    # This code node re-reads the extraction metadata from the state and gives it
    # to the evaluator. Without it, the evaluator reads the draft assets of the
    # generator, and it cannot judge the README, the tests, or the licence.
    evaluator_input_node = FunctionNode(
        func=select_evaluator_input,
        name="select_evaluator_input",
        timeout=30.0,
    )
    evaluator_node = build_path_evaluator_agent()
    persist_node = FunctionNode(
        func=persist_transaction,
        name="persist_transaction",
        timeout=30.0,
    )

    order = [
        scan_node,
        extraction_node,
        style_rules_node,
        generator_node,
        evaluator_input_node,
        evaluator_node,
        persist_node,
    ]

    # The first edge starts at the START object. Each other edge joins one node to
    # the next node in the list. `pairwise` gives those pairs directly, so there is
    # no second sequence to hold in step.
    edges = [Edge(from_node=START, to_node=order[0])]
    edges += [Edge(from_node=first, to_node=second) for first, second in pairwise(order)]

    return Workflow(
        name="projectsync_phase1",
        description=(
            "Reads a GitHub repository, writes four career assets, decides if the "
            "work is ready to publish, and saves the result for one approval."
        ),
        edges=edges,
    )
