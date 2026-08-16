# Stack & Timeline Engineering

> **Track**: Taskmaster · **Build window**: Aug 16 – Aug 30, 2026 — **15 days**
> **Deadline**: **Aug 31, 2026, 5:00 PM PT** (buffer day — do not plan work here)
> **Source of truth**: [projectsync_full_spec.md](../../projectsync_full_spec.md) · **Claims**: [VERIFICATION_LEDGER.md](../VERIFICATION_LEDGER.md)
> **Code to copy from**: [research/adk_api_cheatsheet_notes.md](../research/adk_api_cheatsheet_notes.md)
>
> Rewritten 2026-08-16. The 2026-08-11 version planned 21 days against an architecture with
> Pub/Sub, Gmail OAuth2, ADK 1.x `@tool` functions, and a model below the mandated floor.
> Six of its 21 days were spent on subsystems that no longer exist.

---

## 1. The stack, exactly

| Layer | Choice | Non-negotiable because |
|---|---|---|
| Model | **`gemini-3.7-flash`** | Gemini 3 Flash is **below the mandated 3.5 floor.** Stage One is pass/fail — this is elimination `[L2.3, L3.6]` |
| Framework | **ADK 2.0 graph `Workflow`** (`google-adk` **2.7.0**) | Satisfies the framework requirement. `SequentialAgent` is superseded but not removed — use the graph anyway |
| Compute | **Cloud Run** | Serverless, scale-to-zero, one `gcloud run deploy` from source |
| State | **Firestore** | The durable boundary between Phase 1 and Phase 2 |
| API layer | **FastAPI + uvicorn** | Five endpoints. Approval arrives as an HTTP POST |
| Repo I/O | **httpx** (read) + **PyGithub** (write) | Read is a code node; write is Phase 2 |

**Two GCP services** — one over the minimum of two `[L3.2]`. **No Pub/Sub** (nothing to
decouple: the trigger is a human pasting a URL). **No Gmail API** (3-legged OAuth2 costs
3–5 days and a dashboard does strictly more).

### The graph

```
START
  └─► scan_github_repository      ▪ CODE   httpx, filters, payload budget
        └─► extraction_agent      ● AGENT  output_schema=ExtractedMetadata
              └─► attach_style_rules   ▪ CODE   reads ACTIVE rules → AssetGenInput
                    └─► asset_generator_agent   ● AGENT  four assets, one pass
                          └─► path_evaluator_agent   ● AGENT  temperature=0.0
                                └─► persist_transaction   ▪ CODE   PENDING_APPROVAL
```

Six nodes, three of them Python. Build it with a factory function — a module-level
`Workflow` can bind a node twice on a second import.

### The three contracts that decide whether it runs

| Contract | Consequence of getting it wrong |
|---|---|
| **Code nodes bind a typed parameter. Agent nodes do not** — they receive the predecessor's `Event.output` as user content `[L1.21]` | Input silently absent |
| **One `Event.output` per node execution** `[L1.23]` | Runtime error mid-graph |
| Instruction templating is `{Model.field}`, **never a bare `{state_key}`** `[L1.22]` | Renders as literal text. The learning loop becomes a prop |

> ⚠️ **`output_schema` disables tool calling** on that agent. A node cannot have both. This
> is why the scanner is a code node — the extraction agent never needs a tool.

---

## 2. Timeline

Aug 31 is the deadline, not a work day. Plan 15 days and submit with a day in hand.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              15-DAY BUILD SCHEDULE                                   │
├───────────────────────────┬──────────────────────────────────────────────────────────┤
│ Days 1–7   Aug 16 – 22    │ Core loop. Graph runs end to end. Trivial deploy live     │
│ Days 8–12  Aug 23 – 27    │ Phase 2, memory, fallbacks, failure suite                 │
│ Days 13–15 Aug 28 – 30    │ Deploy, rehearse, record, docs, bonuses, SUBMIT           │
├───────────────────────────┴──────────────────────────────────────────────────────────┤
│ Aug 31, 5:00 PM PT — HARD DEADLINE. Buffer only. Nothing new is built on this day.    │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Phase 1 — Core loop (Days 1–7, Aug 16 Sun – Aug 22 Sat)

**Gate to pass:** the graph runs end to end locally and produces four assets plus a path
recommendation. The model pin is asserted at startup. A trivial container is live on
Cloud Run.

#### Day 1 — Sun Aug 16 · Environment, model pin, import truth

The first hour retires the only elimination-class risk and the biggest unknown.

```bash
pip install google-adk google-genai pydantic fastapi uvicorn httpx \
            google-cloud-firestore PyGithub python-dotenv
python -c "import google.adk; print(google.adk.__version__)"      # Expect 2.7.0
```

Then confirm the real import paths against the installed package — the docs are ambiguous
about `Agent`'s module and this is **unresolved** in the ledger `[L1.7]`:

```bash
python - <<'PY'
import google.adk as adk
print([n for n in dir(adk) if n in ("Workflow", "Agent", "Event", "RequestInput")])
PY
```

`config.py`:

```python
"""Configuration for ProjectSync. Read once at import."""
import os

# The mandated floor is Gemini 3.5. Gemini 3 Flash is below the floor.
# A model below the floor is elimination in the pass/fail Stage One check.
MODEL = os.environ.get("MODEL_ID", "gemini-3.7-flash")
assert MODEL.startswith("gemini-3.7") or MODEL.startswith("gemini-4"), (
    f"Model {MODEL} is below the mandated 3.5 floor. See ledger L2.3."
)
```

Also today: repository skeleton (§4 layout), `.env` from the block in §5, `.gitignore`
before the first commit, and the GCP credit request — knowing the amount and deadline are
**unsourced** `[L3.14]`, so nothing may depend on approval timing.

**Verify:** version prints `2.7.0`; the import probe lists the four names; the model
assertion passes.

#### Day 2 — Mon Aug 17 · Scanner code node

`nodes/scanner.py`. A plain Python function. No LLM, no tool decorator.

```python
IGNORE_DIRS = {".git", "node_modules", "vendor", "dist", "build", "__pycache__", ".venv", "target"}
IGNORE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".pdf", ".zip", ".tar", ".gz", ".mp4", ".pyc", ".ico"}
MAX_FILE_SIZE_BYTES = 100 * 1024      # 100 KB for each code file.
MAX_TOTAL_BYTES = 400 * 1024          # Budget for all of the files together.


def is_relevant_file(file_path: str, file_size: int) -> bool:
    """Tell if a file must go into the model context.

    Filter before the request, not after. A large repository can use all of the
    context window with dependency code.
    """
    parts = file_path.split("/")
    if any(part in IGNORE_DIRS for part in parts):
        return False
    if any(file_path.endswith(ext) for ext in IGNORE_EXTENSIONS):
        return False
    return file_size <= MAX_FILE_SIZE_BYTES
```

Fetch the tree with `?recursive=1`, then the README, the manifests, `/docs`, and the last
50 commits. **Authenticate every call** — unauthenticated GitHub allows 60 requests/hour;
with `GITHUB_TOKEN` it is 5,000. Retry 429 and 403-with-rate-limit-headers with exponential
backoff. Return `RepoScan`.

**Verify:** scans a real public repository; the returned payload is under `MAX_TOTAL_BYTES`;
`node_modules` never appears in the file list.

#### Day 3 — Tue Aug 18 · Extraction agent

`nodes/extraction.py`. First agent node — and the first place the graph contracts matter.

```python
extraction_agent = Agent(
    name="extraction_agent",
    model=MODEL,
    instruction=(
        "Read the repository scan and pull out the technical facts. "
        "Do not invent a fact that the files do not show."
    ),
    output_schema=ExtractedMetadata,
    generate_content_config=genai_types.GenerateContentConfig(temperature=0.2),
)
```

The agent node **does not take `RepoScan` as a parameter.** It receives the scanner's
`Event.output` as user content `[L1.21]`. Wire the edge; do not write a signature.

**Verify:** `output_schema` validates across five different repositories, including one
with no README and one with no manifest.

#### Day 4 — Wed Aug 19 · Style rules code node + asset generator

The two must be built together. Building the generator first is how the `{style_rules}` bug
gets in.

```python
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


def attach_style_rules(node_input: ExtractedMetadata) -> AssetGenInput:
    """Add the current style rules to the input for the generator agent.

    This is a code node. Do not use an agent for this step. An agent must then
    copy each rule, and an agent can omit a rule.
    """
    return AssetGenInput(**node_input.model_dump(), style_rules=read_active_rules())
```

The generator produces `GeneratedAssets` — **one model, four fields**, one pass. Not four
round trips. Its instruction references `{AssetGenInput.style_rules}`.

**Verify:** all four fields are non-empty and well-formed; the KMS sheet parses as YAML
frontmatter plus markdown; the rules list appears in the rendered prompt as *content*, not
as the literal string `{style_rules}`.

#### Day 5 — Thu Aug 20 · Path evaluator

`nodes/evaluator.py`, at `temperature=0.0`. The same repository must always get the same
verdict — a judge may run it twice.

```python
path_evaluator_agent = Agent(
    name="path_evaluator_agent",
    model=MODEL,
    instruction=(
        "Decide if this work is complete enough to publish in public. "
        "Return PRIVATE_ONLY when tests, documentation, or a licence are absent. "
        "Give the reason for each missing item."
    ),
    output_schema=PathRecommendation,
    # Temperature zero. The same repository must give the same result each time.
    generate_content_config=genai_types.GenerateContentConfig(temperature=0.0),
)
```

**Verify — and this is the demo's whole third scene:** an early, genuinely incomplete commit
of this repository returns `PRIVATE_ONLY` with reasons; the current commit returns
`FULL_PUBLISH`. Find that commit SHA today and write it down.

#### Day 6 — Fri Aug 21 · Wire the graph, persist, FastAPI

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

`persist_transaction` writes the Firestore row at `PENDING_APPROVAL`. Then `main.py` with
`POST /api/v1/trigger-sync` and `GET /healthz`.

**Verify:** one POST with a repository URL produces a Firestore document containing four
assets, a path recommendation, and `status: PENDING_APPROVAL`. Then **deploy a trivial
container to Cloud Run** — before the agent is finished. The point is to find the IAM and
billing problems while they are cheap.

```bash
gcloud services enable aiplatform.googleapis.com run.googleapis.com \
                       firestore.googleapis.com secretmanager.googleapis.com
gcloud run deploy projectsync --source . --region us-central1 --allow-unauthenticated
```

#### Day 7 — Sat Aug 22 · Phase 1 gate

End-to-end test from URL to Firestore row. Profile it — know the real wall-clock time before
any of it is on camera. Then **stop and check the gate.** If the graph does not run end to
end today, cut something from Phase 2 rather than sliding the gate.

---

### Phase 2 — Approval, memory, resilience (Days 8–12, Aug 23 Sun – Aug 27 Thu)

**Gate to pass:** two commit SHAs from one approval click. Toggling a rule provably changes
the next draft. Every step in the spec §9 matrix has a fallback.

#### Day 8 — Sun Aug 23 · Firestore layer

Three collections: `projectsync_transactions`, `style_rules`, `users`. The transaction
collection name comes from `FIRESTORE_TRANSACTIONS` and is fixed by spec §3 — do not shorten
it. Two gotchas that cost an hour each if you meet them at 1 a.m.:

- `order_by` on a field **filters out documents where that field is absent.** A query sorted
  by `completed_at` silently hides every pending row.
- If a query has an inequality filter, **that field must be ordered first.**

Use `FieldFilter` — positional-argument `where()` is deprecated.

#### Day 9 — Mon Aug 24 · Phase 2 endpoint and both commits

`POST /api/v1/approval-callback`. Verify token, verify `status == PENDING_APPROVAL`, then
commit to both repositories with **independent success flags**.

```python
def upsert_file(repo, path: str, content: str, message: str) -> str:
    """Write a file to a repository. Make it or change it.

    GitHub has two different calls. Use update_file if the file is present.
    Use create_file if the file is not present. A create call on a file that is
    present gives an error.
    """
    try:
        existing = repo.get_contents(path)
        result = repo.update_file(path, message, content, existing.sha)
    except GithubException as error:
        if error.status != 404:
            raise
        result = repo.create_file(path, message, content)
    return result["commit"].sha
```

The upsert matters on the **second** run of the demo, which is when a create call on an
existing file returns 422.

**Verify:** one click produces two clickable commit SHAs; the Firestore row moves to
`COMPLETED`; a forced failure on one repository leaves the other flag `true`.

#### Day 10 — Tue Aug 25 · Memory, end to end

Rule states `PROPOSED` → `ACTIVE` → `INACTIVE`. `POST /api/v1/rules/{id}` toggles.
`POST /api/v1/regenerate-asset` re-runs generation with current rules — **no re-scan** —
sharing the `AssetGenInput` contract with the graph so there is one generation path, not two.

Then `rule_curator_agent`: it reads the user's edits and proposes rules. Proposals require
approval; nothing becomes `ACTIVE` on its own.

**The test that matters more than any other in this build:**

```python
def test_style_rules_change_output():
    """A toggled rule must change the next draft.

    A test that only shows that generation did not fail cannot tell a working
    memory system from a demonstration of one.
    """
    set_rule_state(rule_id, "INACTIVE")
    before = generate(fixture_metadata)
    set_rule_state(rule_id, "ACTIVE")
    after = generate(fixture_metadata)
    assert before.social_draft != after.social_draft
```

#### Day 11 — Wed Aug 26 · Dashboard

Four editable drafts, the recommendation with reasons, the rule list with toggles, one
Approve button. **No message thread and no send button** — the track brief is *"Build a
Complete Workflow, Not Just a Chatbot."*

Status is **polled**, not streamed. Graph workflows do not support live streaming `[L1.20]`.
A faked progress stream is a lie a judge can catch by reading the repository.

#### Day 12 — Thu Aug 27 · Fallbacks and the failure suite

This is scored work, not polish. The architecture criterion is scored on **"design
failure-tolerant agents"** `[L3.8]`.

A fallback for every step in the spec §9 matrix, plus structured logging with a correlation
id — those logs become the demo's proof shots, so tag them now:

```python
# Tag every log line with the transaction id. These lines are the proof in the
# video, so make them readable before the recording day.
logger.info("node complete", extra={"tx": tx_id, "node": "asset_generator", "ms": elapsed})
```

**Failure suite:** empty repository · no README · no manifest · 500-file monorepo ·
revoked `GITHUB_TOKEN` · GitHub 429 · Gemini 429/503 · malformed model output ·
duplicate approval click · expired token.

**Phase 2 gate. Feature freeze after today.**

---

### Phase 3 — Proof and submission (Days 13–15, Aug 28 Fri – Aug 30 Sun)

#### Day 13 — Fri Aug 28 · Full deploy and rehearsal

Secrets into Secret Manager, IAM roles (`roles/datastore.user`,
`roles/secretmanager.secretAccessor`, `roles/aiplatform.user`), full deploy:

```bash
gcloud run deploy projectsync \
  --source . --region us-central1 --allow-unauthenticated --timeout 300 \
  --set-env-vars GOOGLE_GENAI_USE_VERTEXAI=True,GOOGLE_CLOUD_PROJECT=$GOOGLE_CLOUD_PROJECT,GOOGLE_CLOUD_LOCATION=global,MODEL_ID=gemini-3.7-flash,PORTFOLIO_DATA_REPO=$PORTFOLIO_DATA_REPO,SYNCED_DOCS_PATH=docs/synced,FIRESTORE_TRANSACTIONS=projectsync_transactions \
  --set-secrets GITHUB_TOKEN=github-token:latest
```

`--timeout 300` is sufficient because **Phase 1 does not wait for a human.** That is the
entire reason the two-phase split exists.

Then **rehearse the demo three times.** Measure cold-start latency. A live GitHub scan that
403s on camera is an avoidable disaster.

#### Day 14 — Sat Aug 29 · Record, and re-read the rules

Record ~4 minutes, five scenes
([demo/demo_storyboard_and_mistakes.md](../demo/demo_storyboard_and_mistakes.md)). Scenes 3
and 4 — the negative result and the rule toggle — are the two competitors will not have. Do
not let narration squeeze them.

**Then re-read the rules page against the frozen artefact.** Not against the plan. Confirm:
model at or above the 3.5 floor, ADK present, ≥2 GCP services, public repository, video,
every Devpost field filled. That is Stage One, and it is pass/fail `[L3.6]`.

#### Day 15 — Sun Aug 30 · Docs, bonuses, submit

- README: clone to working request in under 10 minutes. Architecture diagram naming the real
  stack — `gemini-3.7-flash`, ADK graph `Workflow`, Cloud Run, Firestore. No Pub/Sub, no
  Gmail; a diagram showing them contradicts the code.
- Devpost text addressing the three Stage Two criteria **by name**.
- **Stage Three, +0.4 for about two hours** `[L3.7]`: publish the build write-up (+0.2 — the
  material is already in this doc tree) and post with `#AllThingsAgenticHackathon` (+0.2).
- **Submit today.** Aug 31 is buffer.

---

## 3. Firestore schema

```
(default)
├── projectsync_transactions/{tx_id}        ← name fixed by spec §3; from FIRESTORE_TRANSACTIONS
│   ├── status              PENDING_APPROVAL | COMPLETED | FAILED_SCAN |
│   │                       FAILED_EXTRACTION | FAILED_GENERATION | REJECTED
│   ├── repo_url, repo_name, user_id
│   ├── metadata            ExtractedMetadata
│   ├── assets              GeneratedAssets   (four fields)
│   ├── recommendation      PathRecommendation
│   ├── style_rules_applied [str]             ← what was actually used, for audit
│   ├── approval_token      str
│   ├── doc_commit_sha      str | null        ← independent flag: docs/synced/{slug}.md
│   ├── card_commit_sha     str | null        ← independent flag: cards/{slug}.json
│   └── created_at, completed_at              timestamps
├── style_rules/{rule_id}
│   ├── text                str
│   ├── state               PROPOSED | ACTIVE | INACTIVE
│   ├── source              USER | CURATOR
│   └── created_at, updated_at
└── users/{user_id}
    ├── portfolio_data_repo     "<user>/portfolio-data"   ← private, spec §10.1
    └── zero_edit_streak        int   ← 3 consecutive → auto-approve is offered
```

The doc sheet commits to **the scanned repository itself** at `docs/synced/{slug}.md`, so there
is no separate KMS-repo field — the target is whatever repo was just scanned. The
`FAILED_*` statuses come straight from the spec §9 fallback matrix; use those exact strings.

`style_rules_applied` is written on every transaction. Without it there is no way to prove
after the fact which rules shaped a given draft — and that is the audit trail behind the
learning-loop claim.

---

## 4. Repository layout

```
projectsync/
├── config.py           # Model pin. Asserted at import.
├── main.py             # FastAPI, five endpoints.
├── graph.py            # build_phase1_workflow() factory.
├── models.py           # Six Pydantic models.
├── nodes/
│   ├── scanner.py      # CODE
│   ├── extraction.py   # AGENT
│   ├── style_rules.py  # CODE
│   ├── generator.py    # AGENT
│   ├── evaluator.py    # AGENT
│   └── persist.py      # CODE
├── sync/github.py      # Both commits. Upsert.
├── memory/curator.py   # rule_curator_agent
├── static/             # Dashboard.
├── tests/
│   ├── test_nodes.py
│   ├── test_failure_modes.py
│   └── test_style_rules_change_output.py
├── Dockerfile
├── requirements.txt
└── README.md
```

No `pubsub_listener.py`. No `gmail_approval_gate.py`.

---

## 5. Endpoints and environment

| Method | Path | Does |
|---|---|---|
| `POST` | `/api/v1/trigger-sync` | Runs the Phase 1 graph. Returns a transaction id |
| `GET` | `/api/v1/transactions/{id}` | Polled status. Not a stream `[L1.20]` |
| `POST` | `/api/v1/regenerate-asset` | Re-generates with current rules. No re-scan |
| `POST` | `/api/v1/approval-callback` | Phase 2. Both commits, both flags, `COMPLETED` |
| `POST` | `/api/v1/rules/{id}` | Toggle `ACTIVE` / `INACTIVE` |
| `GET` | `/healthz` | Liveness |

Canonical environment — identical to the `.env.example` in
[research/adk_api_cheatsheet_notes.md](../research/adk_api_cheatsheet_notes.md). Do not invent
alternative names.

```bash
# The SDK reads these three itself. The names are fixed. An invented name such as
# USE_VERTEX_AI is silently ignored, and the SDK keeps calling the direct API.
GOOGLE_GENAI_USE_VERTEXAI=True
GOOGLE_CLOUD_PROJECT=projectsync-<suffix>
GOOGLE_CLOUD_LOCATION=global          # A model 404 means correct this, not the model name.  [L2.7]

MODEL_ID=gemini-3.7-flash             # Below the 3.5 floor is elimination in Stage One.

GITHUB_TOKEN=ghp_...                  # Scope "repo". Must read and write.
PORTFOLIO_DATA_REPO=<user>/portfolio-data
SYNCED_DOCS_PATH=docs/synced          # Keeps generated files apart from plan files.
FIRESTORE_TRANSACTIONS=projectsync_transactions
DASHBOARD_BASE_URL=https://...run.app

# Local development only.
FIRESTORE_EMULATOR_HOST=localhost:8080
```

For local work set `GOOGLE_GENAI_USE_VERTEXAI=False` and supply `GOOGLE_API_KEY` — the SDK's
documented direct-API path.

---

## 6. Verification

```bash
# 1. ADK is 2.x, not 1.x.
python -c "import google.adk; print(google.adk.__version__)"        # Expect 2.7.0

# 2. Model pin at or above the mandated floor.
python -c "from config import MODEL; print(MODEL)"                  # gemini-3.7-flash

# 3. Tests.
pytest tests/ -v
pytest tests/test_style_rules_change_output.py -v    # Must FAIL if rules are ignored.
pytest tests/test_failure_modes.py -v

# 4. Container builds and answers.
docker build -t projectsync:test .
docker run --rm -d -p 8080:8080 --name ps-test projectsync:test
curl -f http://localhost:8080/healthz || exit 1
docker stop ps-test
```

### What slips first, if something must

In order. Decided now, while it is a plan and not a panic.

| Cut | Keep |
|---|---|
| Curator agent auto-proposing rules | Manual rule creation and the toggle |
| Auto-approve after three zero-edit approvals | The one-click approval |
| Portfolio repository commit | KMS commit — **one** commit SHA still proves the loop |
| Dashboard polish | The negative result and the rule toggle. **Never cut these two** |

The two scenes that differentiate this build are the last things to go, not the first.

_Last updated: 2026-08-16_
