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

from pydantic import BaseModel, Field, computed_field

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
    CANCELLED = "CANCELLED"


class PublishPath(StrEnum):
    """The two results that the path evaluator can give."""

    FULL_PUBLISH = "FULL_PUBLISH"
    PRIVATE_ONLY = "PRIVATE_ONLY"


class RuleState(StrEnum):
    """The states of one style rule.

    A rule goes from `PROPOSED` to `ACTIVE` only after a person clicks one time.
    A rule that a person dismisses becomes `INACTIVE`. The rule stays in the
    database, because the person can make it active again later.

    A rule that a person deletes becomes `DELETED`. The list of rules does not
    show that rule again. The document also stays in the database. A transaction
    row names the rules that made its draft, so the text of a deleted rule must
    stay for that receipt.
    """

    PROPOSED = "PROPOSED"
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    DELETED = "DELETED"


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


class PortfolioCard(BaseModel):
    """One portfolio card. The `portfolio-data` repository holds one file of this
    shape for each project.

    The fields are explicit, and this model is not a free dictionary. There are two
    reasons for that.

    The first reason is the Gemini Developer API. A free dictionary puts
    `additionalProperties` in the JSON schema, and that API refuses a schema with
    that key: "additionalProperties is only supported in Gemini Enterprise Agent
    Platform mode". Vertex AI accepts it, but the README tells a person to use an
    API key, so a free dictionary stopped the generator on the route that the
    README gives.

    The second reason is the instruction of the generator. That instruction already
    names these five keys, so a type here only makes the promise exact.

    Each field has a default value. A card with one field absent is still valid,
    because a card with four good fields is better than a failed run.

    A person can change each of these five values on the review desk. A key that is
    not in this list does not survive the approval, because the portfolio site reads
    only these five names.
    """

    title: str = ""
    tagline: str = ""
    stack: list[str] = Field(default_factory=list)
    highlights: list[str] = Field(default_factory=list)
    repo_url: str = ""


class GeneratedAssets(BaseModel):
    """The output of `asset_generator_agent`.

    One model with four fields. The generator makes all four assets in one pass.
    Four separate requests cost more and can disagree with each other.
    """

    doc_sheet_md: str = Field(description="The documentation sheet, in markdown.")
    portfolio_card: PortfolioCard = Field(
        default_factory=PortfolioCard, description="The portfolio card, as JSON."
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


class AssetSource(StrEnum):
    """How one asset version came to be."""

    GENERATED = "GENERATED"
    REGENERATED = "REGENERATED"
    HUMAN_EDITED = "HUMAN_EDITED"


class AssetVersion(BaseModel):
    """One snapshot of the four assets. The list of versions never shrinks.

    Each version records where it came from. The transaction row keeps every
    version, so the curator can see the difference between what the model wrote
    and what the person approved.
    """

    assets: GeneratedAssets = Field(description="The four assets in this version.")
    source: AssetSource = AssetSource.GENERATED
    created_at: str = Field(description="`store.now_iso()` at write time.")
    style_rules_applied: list[str] = Field(
        default_factory=list,
        description="The rule identifiers that made this version. Empty for a "
        "human edit, because the person writes the text directly.",
    )


class Transaction(BaseModel):
    """One full row in the `projectsync_transactions` collection.

    This row is also the episodic memory of the system. The curator agent reads
    the most recent rows to propose a new rule.

    `doc_commit_sha` and `card_commit_sha` are two independent flags. If one
    commit fails and the other succeeds, the row shows this. A partial failure
    is a partial success, and the dashboard offers a retry for only the part
    that failed.

    `asset_versions` is append-only. Each generation, regenerate, and approval
    appends a version instead of overwriting the one before it. `assets` is a
    read-only view of the newest version, kept so the interface and the tests
    can read the current draft without walking the list.
    """

    tx_id: str
    user_id: str
    repo_url: str
    repo_name: str
    status: TransactionStatus = TransactionStatus.PENDING_APPROVAL

    metadata: ExtractedMetadata | None = None
    asset_versions: list[AssetVersion] = Field(default_factory=list)
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

    @computed_field
    @property
    def assets(self) -> GeneratedAssets | None:
        """The assets of the newest version, or `None` if there is no version.

        This is a read-only view of `asset_versions[-1]`. It is a computed
        field, not a plain property, so `model_dump()` and the API responses
        include it. The interface reads `tx.assets`, and `ledger.js`,
        `folios.js`, and the tests keep working without a change.
        """
        if not self.asset_versions:
            return None
        return self.asset_versions[-1].assets


# --------------------------------------------------------------------------
# Run events — per-node checkpoint log
# --------------------------------------------------------------------------


class RunEventState(StrEnum):
    """The state of one node in the workflow."""

    STARTED = "STARTED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class RunEvent(BaseModel):
    """One node event in the workflow run log.

    This is written to the `events` subcollection of a transaction row.
    """

    event_id: str
    tx_id: str
    node: str
    state: RunEventState
    started_at: str
    finished_at: str | None = None
    error: str | None = None


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


# --------------------------------------------------------------------------
# Stage 4: Bullet Bank and Social drafts
# --------------------------------------------------------------------------


class BulletTag(StrEnum):
    """Predefined tags for resume bullets."""

    IMPACT = "IMPACT"
    LEADERSHIP = "LEADERSHIP"
    TECHNICAL = "TECHNICAL"
    COLLABORATION = "COLLABORATION"
    PROBLEM_SOLVING = "PROBLEM_SOLVING"
    ARCHITECTURE = "ARCHITECTURE"
    PERFORMANCE = "PERFORMANCE"
    SECURITY = "SECURITY"
    TESTING = "TESTING"
    DEVOPS = "DEVOPS"
    FRONTEND = "FRONTEND"
    BACKEND = "BACKEND"
    DATA = "DATA"
    MOBILE = "MOBILE"
    CLOUD = "CLOUD"


class ResumeBullet(BaseModel):
    """One bullet in the bullet bank.

    The bank is append-only for auto-seeded bullets. A person can add manual
    bullets and edit any bullet. `source_tx_id` links back to the transaction
    that created this bullet, so a person can see the context.
    """

    bullet_id: str
    user_id: str
    text: str
    project: str = Field(description="Project name this bullet came from.")
    source_tx_id: str | None = Field(
        None, description="The transaction that seeded this bullet."
    )
    tags: list[BulletTag] = Field(default_factory=list)
    created_at: str
    is_manual_edit: bool = Field(
        False, description="True if a person wrote or edited this bullet."
    )


class SocialPlatform(StrEnum):
    """Platforms for social drafts."""

    X = "X"
    LINKEDIN = "LINKEDIN"
    DEVTO = "DEVTO"
    PITCH = "PITCH"


class SocialTone(StrEnum):
    """Tones for social drafts."""

    TECHNICAL = "TECHNICAL"
    PUNCHY = "PUNCHY"
    STORYTELLING = "STORYTELLING"


class SocialDraft(BaseModel):
    """One social draft in the drafts collection.

    A draft is tied to a transaction and can be regenerated with different
    platform/tone/prompt combinations without rescanning the repository.
    """

    draft_id: str
    user_id: str
    tx_id: str
    platform: SocialPlatform
    tone: SocialTone
    language: str = "en"
    custom_prompt: str = Field(default="", description="Extra instruction for the generator.")
    text: str
    is_manual_edit: bool = Field(
        False, description="True if a person wrote or edited this draft."
    )
    created_at: str


# --------------------------------------------------------------------------
# Stage 4 request models
# --------------------------------------------------------------------------


class BulletCreateRequest(BaseModel):
    """Create a new bullet in the bank."""

    user_id: str = "default"
    text: str
    project: str
    source_tx_id: str | None = None
    tags: list[BulletTag] = Field(default_factory=list)


class BulletUpdateRequest(BaseModel):
    """Update an existing bullet."""

    text: str | None = None
    tags: list[BulletTag] | None = None
    project: str | None = None


class BulletListRequest(BaseModel):
    """Filters for listing bullets."""

    user_id: str = "default"
    project: str | None = None
    tags: list[BulletTag] | None = None
    limit: int = 50
    offset: int = 0


class SocialDraftCreateRequest(BaseModel):
    """Create a new social draft."""

    user_id: str = "default"
    tx_id: str
    platform: SocialPlatform
    tone: SocialTone
    language: str = "en"
    custom_prompt: str = ""


class SocialDraftUpdateRequest(BaseModel):
    """Update an existing social draft."""

    text: str | None = None
    platform: SocialPlatform | None = None
    tone: SocialTone | None = None
    language: str | None = None
    custom_prompt: str | None = None


class SocialDraftListRequest(BaseModel):
    """Filters for listing social drafts."""

    user_id: str = "default"
    tx_id: str | None = None
    platform: SocialPlatform | None = None
    limit: int = 50
    offset: int = 0


class SocialDraftRegenerateRequest(BaseModel):
    """Regenerate a social draft with new parameters."""

    draft_id: str
    platform: SocialPlatform | None = None
    tone: SocialTone | None = None
    language: str | None = None
    custom_prompt: str | None = None
