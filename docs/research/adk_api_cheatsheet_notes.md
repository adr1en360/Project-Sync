# ADK API Cheat Sheet — ProjectSync Code Blocks

_Updated: 2026-08-16 · Copy-paste source for the build._
_Every API used here is verified in [VERIFICATION_LEDGER.md](../VERIFICATION_LEDGER.md) §1/§4, cited as `[L1.x]`._
_Anything marked ⬜ is **unverified** — confirm against the installed package before trusting it._

**All comments and docstrings below follow ASD-STE100 Simplified Technical English.**
Short sentences, active voice, imperative for instructions, one instruction per sentence,
approved vocabulary, no `-ing` verb forms. Prose outside the code blocks is normal English.

Architecture context: [build/adk_2_0_architecture_migration.md](../build/adk_2_0_architecture_migration.md)

---

## 0. Install & environment

```bash
uv init
uv add google-adk google-genai pydantic httpx google-cloud-firestore PyGithub \
       fastapi uvicorn python-dotenv
uv run python -c "import google.adk; print(google.adk.__version__)"   # Must show 2.7.x  [L1.1]
```

**Day-1 task — resolve the one unpublished signature `[L1.7]`:**
```bash
uv run python -c "import google.adk, inspect; print(inspect.signature(google.adk.Workflow))"
```
Only `name=` and `edges=` are documented. Read the rest off the package and record it in the ledger.

`.env.example`:
```bash
GOOGLE_GENAI_USE_VERTEXAI=True
GOOGLE_CLOUD_PROJECT=projectsync-<suffix>
GOOGLE_CLOUD_LOCATION=global          # If the model gives error 404, correct this value.  [L2.7]
MODEL_ID=gemini-3.7-flash             # Do not use a model before 3.5. This is a pass or fail gate.  [L3.2, L3.6]

GITHUB_TOKEN=ghp_...                  # Scope "repo". The token must read and write.
PORTFOLIO_DATA_REPO=adrienoke/portfolio-data
SYNCED_DOCS_PATH=docs/synced          # Keep the generated files apart from the plan files.
FIRESTORE_TRANSACTIONS=projectsync_transactions
DASHBOARD_BASE_URL=https://...run.app
```

## 1. Imports

```python
# The graph engine.  [L1.3]
from google.adk import Workflow, Event

# Agent import path. The cheat sheet shows this path.
# The graph pages show "from google.adk import Agent".
# Use the path that the installed package gives. Then do not change it.
from google.adk.agents import Agent

from google.adk.runners import Runner                    # [L1.19]
from google.adk.sessions import InMemorySessionService
from google.genai import types as genai_types

from google.cloud import firestore                       # [L4.6]
from google.cloud.firestore_v1.base_query import FieldFilter
from github import Github                                # PyGithub  [L4.1]
from pydantic import BaseModel, Field
from typing import Literal
```

## 2. Data contracts

```python
class RepoScan(BaseModel):
    """The output of the scan node. The scan node does not use a language model."""
    repo_url: str
    repo_name: str
    readme: str = ""
    dependency_manifests: dict[str, str] = Field(default_factory=dict)
    top_modified_files: list[str] = Field(default_factory=list)   # The 10 files with the most commits.
    recent_commits: list[str] = Field(default_factory=list)       # The last 25 commit messages.
    tree_shape: list[str] = Field(default_factory=list)

class ExtractedMetadata(BaseModel):
    """The output of the extraction agent."""
    project_name: str
    one_liner: str
    problem_solved: str
    tech_stack: list[str]
    key_features: list[str]
    architecture_notes: str
    completeness_signals: list[str]

class AssetGenInput(ExtractedMetadata):
    """The input to the asset generator agent.

    This model adds the current style rules. The attach_style_rules code node
    makes this model. A language model does not make it. Do not ask a language
    model to copy a list of rules.

    This model exists for one more reason. The instruction can then use the
    approved template form "{AssetGenInput.style_rules}". A single key in
    braces does not work in a graph agent node.  [L1.22]
    """
    style_rules: list[str] = Field(default_factory=list)

class GeneratedAssets(BaseModel):
    """The four career assets. This is one model with four fields.

    A node can send only one Event.output payload for each execution. Four
    separate payloads cause an error at run time.  [L1.14]
    """
    doc_sheet_md: str          = Field(description="The documentation sheet, in markdown")
    portfolio_card: dict       = Field(description="The portfolio card, in JSON")
    resume_bullets: list[str]  = Field(description="Resume lines: verb, then technology, then result")
    social_post: str           = Field(description="A draft post. The user copies it. The agent does not send it")

class PathRecommendation(BaseModel):
    """The output of the path evaluator agent.

    "Complete" means that the repository is safe to show to a person who does
    not know it. The repository must have a correct README file. It must have
    no secrets. It must have no TODO notes in the main files. "Complete" does
    not mean that the code operates correctly.
    """
    decision: Literal["FULL_PUBLISH", "PRIVATE_ONLY"]
    score: int = Field(ge=0, le=100)
    reasoning: str
    red_flags: list[str] = Field(default_factory=list)

class StyleRule(BaseModel):
    """One style rule in the semantic memory."""
    rule_text: str
    source_transaction_id: str
    created_at: str
    state: Literal["PROPOSED", "ACTIVE", "INACTIVE"]
```

## 3. Code nodes

A graph code node is **a plain callable in the `edges` tuple** `[L1.4]`. There is no decorator and no wrapper.
It receives the payload from the node before it as its declared parameter, and passes its own payload with the return value `[L1.13]`.

```python
import httpx

GITHUB_API = "https://api.github.com"
IGNORE_EXT = {".png", ".jpg", ".svg", ".lock", ".min.js", ".woff", ".ico"}
MANIFESTS  = {"requirements.txt", "pyproject.toml", "package.json", "go.mod", "Cargo.toml"}

def scan_github_repository(repo_url: str) -> RepoScan:
    """Read the repository with the GitHub REST API.

    This node is the entry point. It does not use a language model. It reads
    the README file, the dependency files, the 10 files with the most commits,
    the last 25 commits, and the shape of the file tree.
    """
    owner, name = repo_url.rstrip("/").split("/")[-2:]
    headers = {"Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}",
               "Accept": "application/vnd.github+json"}

    with httpx.Client(headers=headers, timeout=15.0) as c:
        readme = ""
        r = c.get(f"{GITHUB_API}/repos/{owner}/{name}/readme")
        if r.status_code == 200:
            readme = base64.b64decode(r.json()["content"]).decode("utf-8", "replace")

        commits = c.get(f"{GITHUB_API}/repos/{owner}/{name}/commits",
                        params={"per_page": 25}).json()
        recent = [x["commit"]["message"].splitlines()[0] for x in commits]

        default_branch = c.get(f"{GITHUB_API}/repos/{owner}/{name}").json()["default_branch"]
        tree = c.get(f"{GITHUB_API}/repos/{owner}/{name}/git/trees/{default_branch}",
                     params={"recursive": "1"}).json().get("tree", [])
        paths = [t["path"] for t in tree if t["type"] == "blob"
                 and not any(t["path"].endswith(e) for e in IGNORE_EXT)]

        manifests = {}
        for p in paths:
            if p.split("/")[-1] in MANIFESTS:
                mr = c.get(f"{GITHUB_API}/repos/{owner}/{name}/contents/{p}")
                if mr.status_code == 200:
                    manifests[p] = base64.b64decode(mr.json()["content"]).decode("utf-8", "replace")

        # Count the changes for each file. This loop makes one request for each commit.
        churn = Counter(f["filename"] for x in commits
                        for f in c.get(x["url"]).json().get("files", []))

    return RepoScan(
        repo_url=repo_url, repo_name=f"{owner}/{name}", readme=readme,
        dependency_manifests=manifests,
        top_modified_files=[f for f, _ in churn.most_common(10)],
        recent_commits=recent, tree_shape=paths[:200],
    )
```

> The per-commit file loop is N+1 requests against a 25-commit window. Fine for demo scale; if it rate-limits, drop to the tree listing alone and note the tradeoff. Fallback on the second failure: status `FAILED_SCAN`.

### The style-rules code node

This node is between the extraction agent and the generator agent. It reads the `ACTIVE` rules at the time of generation, not at the time of the scan.

```python
def attach_style_rules(node_input: ExtractedMetadata) -> AssetGenInput:
    """Add the current style rules to the input for the generator agent.

    This is a code node. Do not use an agent for this step. An agent must then
    copy each rule, and an agent can omit a rule.
    """
    return AssetGenInput(**node_input.model_dump(), style_rules=read_active_rules())
```

## 4. The three LLM agents

```python
MODEL = os.environ["MODEL_ID"]        # gemini-3.7-flash

extraction_agent = Agent(
    name="extraction_agent",
    model=MODEL,
    instruction=(
        "Read the repository scan. Extract the project data into the given fields. "
        "Use only the facts in the scan. If a fact is not in the scan, leave the "
        "field empty. Do not guess a value."
    ),
    input_schema=RepoScan,
    output_schema=ExtractedMetadata,     # This setting stops all tool calls.  [L1.17]
)

asset_generator_agent = Agent(
    name="asset_generator_agent",
    model=MODEL,
    instruction=(
        "Make four career assets from this project data:\n"
        "{AssetGenInput.project_name} — {AssetGenInput.one_liner}\n"
        "Problem solved: {AssetGenInput.problem_solved}\n"
        "Technology: {AssetGenInput.tech_stack}\n"
        "Features: {AssetGenInput.key_features}\n\n"
        "Obey these style rules:\n{AssetGenInput.style_rules}\n\n"
        "Make these four assets:\n"
        "1. A documentation sheet in markdown.\n"
        "2. A portfolio card in JSON.\n"
        "3. Resume lines. Put the verb first, then the technology, then the result.\n"
        "4. A draft post for LinkedIn and X.\n"
        "Put all four assets in one GeneratedAssets object."
    ),
    input_schema=AssetGenInput,
    output_schema=GeneratedAssets,
    generate_content_config=genai_types.GenerateContentConfig(
        temperature=0.7, max_output_tokens=14000,
    ),
)

path_evaluator_agent = Agent(
    name="path_evaluator_agent",
    model=MODEL,
    instruction=(
        "Decide if this repository is safe to show to a person who does not know it. "
        "Do not decide if the code operates correctly. A repository that operates "
        "correctly can still fail this test.\n"
        "Look for these items:\n"
        "1. A correct README file.\n"
        "2. No secrets and no API keys.\n"
        "3. No TODO notes and no FIXME notes in the main files.\n"
        "4. No placeholder text.\n"
        "Give a score from 0 to 100. Give the result FULL_PUBLISH only if the score "
        "is 70 or more and there are no problems. In all other conditions, give the "
        "result PRIVATE_ONLY. If you are not sure, give the result PRIVATE_ONLY."
    ),
    input_schema=GeneratedAssets,
    output_schema=PathRecommendation,
    generate_content_config=genai_types.GenerateContentConfig(temperature=0.0),
)
```

> **Instruction templating — resolved 2026-08-16, no longer an open question `[L1.16, L1.22]`.** Graph agent nodes have exactly two documented forms: `{Model.field}`, and `<Model.field from producing_node>` to qualify by producer. A **bare `{style_rules}` does not work here** — bare-key interpolation is the *prebuilt* `SequentialAgent`/`LoopAgent` + `output_key` mechanism, a different model. That is why `attach_style_rules` exists.

> **Agent nodes receive input differently from code nodes `[L1.21]`.** A code node binds the predecessor payload to its declared parameter. An agent node does not: "the predecessor's `event.Output` is delivered as the agent's user content." `input_schema` governs coercion. Don't expect a function-style signature on an agent.

## 5. Graph assembly

```python
def build_phase1_workflow() -> Workflow:
    """Make the Phase 1 graph.

    Use this factory function. Do not put the graph in a module variable. On a
    second import, a module variable can bind a node two times.
    """
    return Workflow(
        name="project_sync_phase1",
        edges=[("START",                      # "START" is the entry node.  [L1.5]
                scan_github_repository,       # Code node.
                extraction_agent,
                attach_style_rules,           # Code node. It reads the current rules.
                asset_generator_agent,
                path_evaluator_agent,
                persist_transaction)],        # Code node.
    )
```

Running it `[L1.19]`:

```python
session_service = InMemorySessionService()
await session_service.create_session(app_name="projectsync", user_id="adrienoke", session_id="s1")
runner = Runner(agent=build_phase1_workflow(), app_name="projectsync",
                session_service=session_service)

async for event in runner.run_async(
    user_id="adrienoke", session_id="s1",
    new_message=genai_types.Content(role="user",
        parts=[genai_types.Part.from_text(text=repo_url)]),
):
    if event.is_final_response():
        print(event.content.parts[0].text)
```

⬜ **Unverified:** how a graph `Workflow` reads its initial input from `new_message` versus a typed entry parameter. Test both on Day 2 and record the answer.

## 6. Firestore — episodic + semantic memory

```python
db = firestore.Client()

def persist_transaction(node_input: PathRecommendation) -> Event:
    """Write the transaction row to Firestore. This node is the last node.

    You must write the created_at field. The order_by function removes a
    document if the document does not have the sort field. The Rule Curator
    query then does not find the row.  [L4.7]
    """
    ref = db.collection(os.environ["FIRESTORE_TRANSACTIONS"]).document()
    ref.set({
        "repo_url": ..., "extracted_metadata": ..., "generated_assets": ...,
        "path_recommendation": node_input.model_dump(),
        "status": "PENDING_APPROVAL",
        "created_at": firestore.SERVER_TIMESTAMP,     # You must write this field.
        "doc_sheet_committed": False,                 # These are two separate flags.
        "portfolio_card_committed": False,            # A failure of one flag does not set the other.
        "user_edits": [],
    })
    return Event(output={"transaction_id": ref.id},
                 message=f"Ready for review: {ref.id}")

def read_active_rules(user_id: str = "adrienoke") -> list[str]:
    """Read the ACTIVE style rules from Firestore.

    Read the rules for each Phase 1 run and for each regeneration. Do not keep
    the rules in a cache. A change to a rule then applies to the next
    generation, and you do not deploy the application again.
    """
    q = (db.collection("users").document(user_id).collection("style_rules")
           .where(filter=FieldFilter("state", "==", "ACTIVE")))     # [L4.6]
    return [d.to_dict()["rule_text"] for d in q.stream()]

def recent_completed(user_id: str, n: int = 10) -> list[dict]:
    """Read the last n completed transactions. This is the Rule Curator input.

    This query sorts by date. It does not use vector search. It needs no index.
    """
    q = (db.collection(os.environ["FIRESTORE_TRANSACTIONS"])
           .where(filter=FieldFilter("status", "==", "COMPLETED"))
           .order_by("created_at", direction=firestore.Query.DESCENDING)
           .limit(n))
    return [d.to_dict() for d in q.stream()]
```

> **Firestore gotcha `[L4.8]`:** an inequality filter implies ordering on that field, and it must be the *first* ordering. `status == "COMPLETED"` is an equality filter, so ordering by `created_at` is safe here. Adding a range filter on a different field later would break it.

## 7. Publishing — PyGithub, two independent targets

```python
def upsert_file(repo_full_name: str, path: str, content: str, message: str) -> str:
    """Write the file to the repository. Return the commit SHA.

    The commit SHA is the proof that the loop is complete.  [L4.1 to L4.3]
    """
    repo = Github(os.environ["GITHUB_TOKEN"]).get_repo(repo_full_name)
    try:
        existing = repo.get_contents(path)
        # The update_file function needs the SHA of the old file.  [L4.2]
        res = repo.update_file(path, message, content, existing.sha)
    except Exception:
        # The documentation does not give the exact exception. Find it on Day 6.  [L4.4]
        res = repo.create_file(path, message, content)
    return res["commit"].sha
```

Two targets, tracked independently so a failure in one never marks the other done:

```python
# Target 1: the documentation sheet goes to the repository of the user.
doc_sha  = upsert_file(target_repo, f"{os.environ['SYNCED_DOCS_PATH']}/{slug}.md",
                       assets.doc_sheet_md, f"docs: add {slug} sheet via ProjectSync")

# Target 2: the portfolio card goes to the private portfolio-data repository.
card_sha = upsert_file(os.environ["PORTFOLIO_DATA_REPO"], f"cards/{slug}.json",
                       json.dumps(assets.portfolio_card, indent=2),
                       f"portfolio: add {slug} card")
```

## 8. FastAPI — Phase 2

Plain FastAPI, outside the graph. Not `get_fast_api_app` — that helper is ⬜ unverified and we need custom routes regardless.

```python
app = FastAPI(title="ProjectSync")

@app.post("/api/v1/trigger-sync")
async def trigger_sync(body: TriggerBody, background: BackgroundTasks):
    """Start the Phase 1 graph. Return before the graph is complete."""
    background.add_task(run_phase1, body.repo_url)
    return {"status": "accepted"}          # Status code 202.

@app.post("/api/v1/approval-callback")
async def approval_callback(body: ApprovalBody):
    """Do the work after the user approves.

    This function makes two commits. Then it starts the Rule Curator. Then it
    sets the status to COMPLETED.
    """
    txn = get_txn(body.transaction_id)
    if txn["status"] == "COMPLETED":
        # Do the same operation two times safely. Do not make the commits again.
        raise HTTPException(409, "already completed")
    if body.decision == "DISCARD":
        set_status(body.transaction_id, "DISCARDED"); return {"status": "discarded"}

    assets = apply_edits(txn["generated_assets"], body.edited_assets)
    results = {}
    for key, fn in (("doc_sheet_committed", commit_doc_sheet),
                    ("portfolio_card_committed", commit_portfolio_card)):
        try:
            # Each commit is separate. A failure of one commit does not stop the other.
            results[key] = fn(txn, assets)
            mark(body.transaction_id, key, True)
        except Exception as e:
            # Record the failure. A retry then applies to this commit only.
            log_failure(body.transaction_id, key, e)

    try:
        propose_rules(txn, body.rule_flags)                # The Rule Curator.
    except Exception as e:
        # The Rule Curator must not stop the approval. Record the error and continue.
        log.warning("curator skipped: %s", e)

    set_status(body.transaction_id, "COMPLETED")
    return {"status": "completed", **results}

@app.post("/api/v1/regenerate-asset")
async def regenerate(body: RegenerateBody):
    """Run the asset generator agent again, and no other agent.

    Use the stored project data and the current ACTIVE rules. Do not scan the
    repository again. Do not run the extraction agent again.
    """
    txn = get_txn(body.transaction_id)
    return await run_agent_alone(asset_generator_agent,
                                 ExtractedMetadata(**txn["extracted_metadata"]),
                                 read_active_rules())

@app.post("/api/v1/rules/{rule_id}/activate")
async def activate_rule(rule_id: str):
    """Change the rule state from PROPOSED to ACTIVE.

    The user does this with one click. A person must approve each rule.
    """
    set_rule_state(rule_id, "ACTIVE"); return {"state": "ACTIVE"}
```

## 9. Rule Curator

Runs after Approve, as a sub-agent. Reads the last N completed rows via the plain recency query in §6. Writes `PROPOSED` only — never `ACTIVE`.

```python
rule_curator_agent = Agent(
    name="rule_curator",
    model=MODEL,
    instruction=(
        "Read the recent approved transactions of the user. Read the changes that "
        "the user made.\n"
        "Propose a maximum of one style rule. The rule must be short and clear. "
        "More than one project must show the same pattern.\n"
        "Do not make a rule because the user made no changes to one project.\n"
        "There is one exception. If the user approved the same asset type three "
        "times, and made no changes each time, propose this rule: keep this format "
        "as the default format.\n"
        "If the data does not show a pattern, propose no rule."
    ),
    input_schema=CuratorInput,
    output_schema=ProposedRule,
    generate_content_config=genai_types.GenerateContentConfig(temperature=0.2),
)
```

> **Rejected by design:** inferring a rule from silence. Silence may mean the user liked the output or that they didn't read it. Building inference on an unverified signal adds complexity for no confirmed benefit.

## 10. Human-input primitive — evaluated, not used

Recorded so the decision is defensible rather than accidental.

```python
# This class is real in ADK Python 2.0 and later.  [L1.10]
from google.adk.events import RequestInput

def approval_node(node_input):
    """This is the graph node that ProjectSync does not use. See the text below."""
    yield RequestInput(message="Approve these assets?",
                       payload=node_input, response_schema=ApprovalDecision)
```

Rejected because `RequestInput`'s pause durability across a process restart is **undocumented** `[L1.11]`, and Cloud Run scales to zero while an approval may arrive days later. It also does not coerce the reply into `response_schema` `[L1.12]`. ADK *does* ship a durable Firestore session service — but it is **Java only** `[L1.24]`, so there is no Python path to a durable pause. Firestore-backed Phase 2 gives durable correlation by transaction ID.

**Never tell a judge "ADK can't do this."** It can; we chose otherwise, on state-durability grounds.

_Last updated: 2026-08-16_
