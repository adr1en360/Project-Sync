"""The data contracts between the nodes of the graph.

Each model is the output of one node, or the input of one node. The graph moves
these models between the nodes. Do not put a free dictionary in an edge.

Two rules control how these models move between the nodes:

* A code node keeps the default parameter binding, which is `"state"`. In that
  mode a parameter with the name `node_input` gets the output of the node before
  it, and the framework changes the value to the type in the annotation. Each
  other parameter comes from `ctx.state` by its name. If a parameter is not in
  the state and has no default value, the node raises a `ValueError`.
  `parameter_binding="node_input"` is a different mode: it takes each parameter
  out of the payload one by one, for a node that works as a tool of an agent.
* An agent node does not bind a parameter. It gets the `Event.output` of the
  node before it as user content.

The framework changes a model that a node returns to a dictionary, and puts the
dictionary in `Event.output`. The next node changes it back to the model in its
annotation. So each node can use a typed model, but the data on the edge is JSON.

The last section of this file holds the request body of each endpoint. Those
models are not part of the graph, but they are the same kind of contract, and one
file for all of them is easier to read than two.
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field

# --------------------------------------------------------------------------
# Enumerations
# --------------------------------------------------------------------------


class TransactionStatus(StrEnum):
    """The states of one transaction row in Firestore.

    Each failure has its own state. A person who looks at the row must see which
    step failed, and not only that the run failed.
    """

    RUNNING = "RUNNING"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    PARTIAL = "PARTIAL"
    COMPLETED = "COMPLETED"
    REJECTED = "REJECTED"
    FAILED_SCAN = "FAILED_SCAN"
    FAILED_EXTRACTION = "FAILED_EXTRACTION"
    FAILED_GENERATION = "FAILED_GENERATION"


class PublishPath(StrEnum):
    """The two results that the path evaluator can give."""

    FULL_PUBLISH = "FULL_PUBLISH"
    PRIVATE_ONLY = "PRIVATE_ONLY"


class RuleState(StrEnum):
    """The states of one style rule.

    A rule goes from `PROPOSED` to `ACTIVE` only after a person clicks one time.
    A rule that a person dismisses becomes `INACTIVE`. The rule stays in the
    database, because the person can make it active again later.
    """

    PROPOSED = "PROPOSED"
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class RuleSource(StrEnum):
    """Tells if a person wrote the rule, or the curator agent proposed it."""

    USER = "USER"
    CURATOR = "CURATOR"


# --------------------------------------------------------------------------
# Node 1 output: the repository scan
# --------------------------------------------------------------------------


class ScannedFile(BaseModel):
    """One file that the scan keeps."""

    path: str
    size_bytes: int
    content: str | None = Field(
        None, description="The text of the file. This field is empty for a large file."
    )


class RepoScan(BaseModel):
    """The output of `scan_github_repository`. No model makes this data.

    The scan filters the files before the request. It does not filter them after
    the request. A large repository can fill all of the context window with
    dependency code.
    """

    repo_url: str
    repo_name: str = Field(description="The format is `owner/name`.")
    default_branch: str
    commit_sha: str = Field(description="The commit that the scan read.")

    readme: str | None = None
    manifests: dict[str, str] = Field(
        default_factory=dict,
        description="The build files. The key is the path and the value is the text.",
    )
    files: list[ScannedFile] = Field(default_factory=list)
    directory_shape: list[str] = Field(
        default_factory=list, description="The top folders of the repository."
    )
    recent_commit_messages: list[str] = Field(default_factory=list)

    total_files_seen: int = 0
    files_kept: int = 0
    payload_bytes: int = 0

    has_tests: bool = False
    has_license: bool = False
    has_ci: bool = False


# --------------------------------------------------------------------------
# Node 2 output: the extracted metadata
# --------------------------------------------------------------------------


class ExtractedMetadata(BaseModel):
    """The output of `extraction_agent`.

    The agent must not write a fact that the files do not show.
    """

    project_name: str
    tagline: str = Field(description="One sentence. No more than 20 words.")
    problem_solved: str
    tech_stack: list[str] = Field(default_factory=list)
    key_features: list[str] = Field(default_factory=list)
    architecture_summary: str = ""

    has_readme: bool = False
    has_tests: bool = False
    has_license: bool = False
    completeness_notes: list[str] = Field(
        default_factory=list,
        description="What the repository does not have. The evaluator reads this list.",
    )


# --------------------------------------------------------------------------
# Node 3 output: the input for the generator
# --------------------------------------------------------------------------


class AssetGenInput(BaseModel):
    """The output of `attach_style_rules`. Code makes this model, never a model.

    This model exists because no language model must copy a list of rules forward.
    A model can change the words of a rule, or drop a rule.

    The generator agent gets this whole model as the message of the user, in JSON.
    The framework calls `model_dump_json()` on it and appends the result as a user
    event. So the instruction of the generator needs no template field.

    Do not write `{AssetGenInput.style_rules}` in an instruction. The template
    engine accepts only a name that is a valid Python identifier, or a name with
    the prefix `app:`, `user:`, or `temp:`. A name with a dot in it is not an
    identifier, so the engine leaves the text as it is and the model reads the
    braces. Nothing raises an error, and the rules have no effect.
    """

    metadata: ExtractedMetadata
    style_rules: list[str] = Field(
        default_factory=list,
        description="The text of each ACTIVE rule. Firestore gives these rules live.",
    )
    style_rule_ids: list[str] = Field(
        default_factory=list,
        description="The identifier of each rule. The transaction row keeps this list "
        "to show which rules made this draft.",
    )


# --------------------------------------------------------------------------
# Node 4 output: the four assets
# --------------------------------------------------------------------------


class GeneratedAssets(BaseModel):
    """The output of `asset_generator_agent`.

    One model with four fields. The generator makes all four assets in one pass.
    Four separate requests cost more and can disagree with each other.
    """

    doc_sheet_md: str = Field(description="The documentation sheet, in markdown.")
    portfolio_card: dict = Field(
        default_factory=dict, description="The portfolio card, as JSON."
    )
    resume_bullets: list[str] = Field(default_factory=list)
    social_draft: str = ""


# --------------------------------------------------------------------------
# Node 5 output: the recommendation
# --------------------------------------------------------------------------


class PathRecommendation(BaseModel):
    """The output of `path_evaluator_agent`. The temperature is 0.0.

    The word "complete" here does not mean that the code runs. It means that the
    repository is safe to show to a stranger: it has a real README, it has no
    secret in the files, and it has no unfinished note in a main file. A
    repository can run correctly and still fail this test.
    """

    recommendation: PublishPath
    reasons: list[str] = Field(
        default_factory=list, description="Why the agent gave this result."
    )
    missing_elements: list[str] = Field(
        default_factory=list, description="What the repository must add to publish."
    )
    confidence: float = Field(0.0, ge=0.0, le=1.0)


# --------------------------------------------------------------------------
# Memory
# --------------------------------------------------------------------------


class StyleRule(BaseModel):
    """One rule about the voice of the user.

    The curator agent proposes a rule. A person makes the rule active. Nothing
    becomes active without one click.
    """

    rule_id: str
    text: str
    state: RuleState = RuleState.PROPOSED
    source: RuleSource = RuleSource.CURATOR
    source_transaction_id: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


# --------------------------------------------------------------------------
# The transaction row
# --------------------------------------------------------------------------


class Transaction(BaseModel):
    """One full row in the `projectsync_transactions` collection.

    This row is also the episodic memory of the system. The curator agent reads
    the most recent rows to propose a new rule.

    `doc_commit_sha` and `card_commit_sha` are two independent flags. If one
    commit fails and the other succeeds, the row shows this. A partial failure
    is a partial success, and the dashboard offers a retry for only the part
    that failed.
    """

    tx_id: str
    user_id: str
    repo_url: str
    repo_name: str
    status: TransactionStatus = TransactionStatus.PENDING_APPROVAL

    metadata: ExtractedMetadata | None = None
    assets: GeneratedAssets | None = None
    recommendation: PathRecommendation | None = None

    style_rules_applied: list[str] = Field(
        default_factory=list, description="The rules that made this draft."
    )
    approval_token: str | None = None

    doc_commit_sha: str | None = None
    card_commit_sha: str | None = None

    error_message: str | None = None
    created_at: str | None = None
    completed_at: str | None = None


# --------------------------------------------------------------------------
# The request body of each endpoint
# --------------------------------------------------------------------------


class SyncRequest(BaseModel):
    """What a person sends to `POST /api/v1/trigger-sync`.

    The three fields go into the state of the run, with the `state_delta` argument
    of `run_async`. The first code node then reads each field from the state by its
    name. This model is not the input on the first edge: the START node gives user
    content of the type `types.Content`, and that type does not change into a
    model.
    """

    repo_url: str = Field(description="The full URL of the GitHub repository.")
    user_id: str = Field("default", description="The owner of the style rules.")
    commit_sha: str | None = Field(
        None,
        description="Read this commit and not the head of the branch. The demo uses "
        "this field to scan an early, incomplete commit.",
    )


class RegenerateRequest(BaseModel):
    """What a client sends to make the assets of one transaction again."""

    transaction_id: str


class ApprovalRequest(BaseModel):
    """What the approve action and the discard action send."""

    transaction_id: str
    approved: bool = True
    edited_assets: GeneratedAssets | None = None


class RuleStateRequest(BaseModel):
    """What the change of one rule sends."""

    state: RuleState


class NewRuleRequest(BaseModel):
    """What a person sends to write a rule by hand."""

    user_id: str = "default"
    text: str
