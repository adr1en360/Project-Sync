# Master Build Blueprint

> **Event**: All Things Agentic Hackathon (Google Cloud & Devpost) · **Track**: Taskmaster
> **Window**: Aug 16 → **Aug 31, 2026, 5:00 PM PT** — **15 days**
> **Source of truth**: [projectsync_full_spec.md](../../projectsync_full_spec.md) (locked Aug 15)
> **Claim audit**: [VERIFICATION_LEDGER.md](../VERIFICATION_LEDGER.md)
>
> Rewritten 2026-08-16. The 2026-08-11 version restated all four research documents inline,
> which meant every correction had to be made twice and the copies drifted apart. **This file
> is now an index plus the deployment manifests.** Detail lives in one place each.

---

## 1. What is being built

ProjectSync turns a finished GitHub repository into four career assets, decides whether the
work is good enough to publish publicly, waits for one human approval, then commits to two
repositories. It learns the user's style rules over time.

**Stack, exactly:** `gemini-3.7-flash` · ADK 2.0 graph `Workflow` · Cloud Run · Firestore.
Two GCP services — one over the minimum `[L3.2]`. **No Pub/Sub. No Gmail API.** Both were
evaluated and cut; reasons in
[product_story_and_requirements.md](../research/product_story_and_requirements.md).

### Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                         PROJECTSYNC — PHASE 1 (synchronous)                          │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   Dashboard form  ──POST /api/v1/trigger-sync──►  Cloud Run (FastAPI)                │
│   (a human pastes a repo URL)                        │                               │
│                                                      ▼                               │
│                                        ADK 2.0 graph Workflow                        │
│                                                                                      │
│   START                                                                              │
│     └─► scan_github_repository   ▪ CODE   httpx + filters, no LLM                     │
│           └─► extraction_agent   ● AGENT  gemini-3.7-flash, output_schema             │
│                 └─► attach_style_rules  ▪ CODE  reads ACTIVE rules from Firestore     │
│                       └─► asset_generator_agent  ● AGENT  four assets, one model      │
│                             └─► path_evaluator_agent  ● AGENT  temperature=0.0        │
│                                   └─► persist_transaction  ▪ CODE  Firestore write    │
│                                                                                      │
│   Response: 200 OK. Firestore row = PENDING_APPROVAL. No thread is held open.         │
│                                                                                      │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                    PHASE 2 (separate request — minutes or days later)                 │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   Dashboard "Approve"  ──POST /api/v1/approval-callback──►  Cloud Run                 │
│                                                      │                               │
│                          ┌───────────────────────────┼───────────────────────────┐    │
│                          ▼                           ▼                           ▼    │
│                   The scanned repo          portfolio-data (PRIVATE)      Firestore   │
│                   docs/synced/{slug}.md     cards/{slug}.json              COMPLETED   │
│                   markdown                  JSON                                      │
│                   commit SHA  ◄── the proof ──►  commit SHA                           │
│                                                                                      │
│   Two independent success flags. A partial failure is a partial success.              │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

**Three of six nodes are deterministic Python.** That ratio is the argument against "thin
wrapper" and it is scored under Architectural Discipline.

---

## 2. Where everything lives

Read the target file. Do not read a summary of it.

| Question | File |
|---|---|
| **Copy-paste code for every node** | [research/adk_api_cheatsheet_notes.md](../research/adk_api_cheatsheet_notes.md) |
| Which ADK 2.0 APIs are real, and the gotchas | [research/adk_framework_reference_digest.md](../research/adk_framework_reference_digest.md) |
| Node-by-node migration from the old design | [adk_2_0_architecture_migration.md](adk_2_0_architecture_migration.md) |
| Day-by-day plan, 15 days | [stack_and_timeline_engineering.md](stack_and_timeline_engineering.md) |
| Risk register and win strategy | [research/strategic_risk_and_win_analysis.md](../research/strategic_risk_and_win_analysis.md) |
| What to read, in order | [research/resource_roadmap.md](../research/resource_roadmap.md) |
| Problem, scope, what was cut | [research/problem_statements.md](../research/problem_statements.md) |
| User journey, memory design, env vars | [research/product_story_and_requirements.md](../research/product_story_and_requirements.md) |
| Demo script and mistakes | [demo/demo_storyboard_and_mistakes.md](../demo/demo_storyboard_and_mistakes.md) |
| Rubric, timeline, competitive read | [research/web_evidence_and_analysis.md](../research/web_evidence_and_analysis.md) |
| **Every factual claim, with a verdict** | [VERIFICATION_LEDGER.md](../VERIFICATION_LEDGER.md) |

---

## 3. The five things that must not drift

Each of these was wrong somewhere in this tree on 2026-08-15. Check them before every commit.

| # | Constraint | Why it matters |
|---|---|---|
| 1 | Model is **`gemini-3.7-flash`**, pinned in `config.py`, asserted at startup | Gemini 3 Flash is **below the mandated 3.5 floor.** Stage One is pass/fail — this is elimination, not a deduction `[L2.3, L3.6]` |
| 2 | Style rules reach the model **on the input model**, and the generator instruction has no template field at all | A dotted `{AssetGenInput.style_rules}` fails the state-name check and reaches the model as literal braces. Nothing raises. The rules would render as text and the learning loop would be a prop `[L1.28]` |
| 3 | **Agent nodes do not bind a typed parameter.** They get the predecessor's `Event.output` as user content | Code nodes do bind one. Mixing the two models means input silently absent `[L1.21]` |
| 4 | **One `Event.output` per node execution** | Yielding twice is a runtime error mid-graph `[L1.23]` |
| 5 | No Pub/Sub, no Gmail, no `AgentRunner`, no `@tool` | All four are either cut or ADK 1.x. A diagram showing them contradicts the code |

### Judging structure — three stages

| Stage | Mechanic |
|---|---|
| **One** | **Pass/fail completeness check. Nothing is scored until it passes** `[L3.6]` |
| **Two** | **1–5 per criterion**, weighted 40 / 30 / 30 |
| **Three** | Bonuses. Max final score **6** `[L3.7]` |

There is no 100-point scale. The "96/100 target score" in the earlier version of this file
was invented, along with its per-row sub-scores.

Stage Two's architecture criterion is scored on decoupling, state management, and **"design
failure-tolerant agents"** `[L3.8]` — which is why the spec §9 fallback matrix is scored work
and not polish.

Stage Three is **+0.4 for about two hours**: publish the build write-up, post with
`#AllThingsAgenticHackathon`.

---

## 4. Data models

Full definitions with docstrings:
[research/adk_api_cheatsheet_notes.md](../research/adk_api_cheatsheet_notes.md). Shapes only
here.

| Model | Produced by | Notes |
|---|---|---|
| `RepoScan` | `scan_github_repository` (code) | Filtered file list, README, manifests, commit count |
| `ExtractedMetadata` | `extraction_agent` | Name, tagline, stack, features, completeness signals |
| `AssetGenInput` | `attach_style_rules` (code) | `ExtractedMetadata` + `style_rules: list[str]`. **Built by code, never by an LLM** |
| `GeneratedAssets` | `asset_generator_agent` | **One model, four fields.** One generation pass, not four round trips |
| `PathRecommendation` | `path_evaluator_agent` | `FULL_PUBLISH` \| `PRIVATE_ONLY`, reasons, missing elements |
| `StyleRule` | the curator, or a human | `PROPOSED` → `ACTIVE` → `INACTIVE` |

`AssetGenInput` exists so that no language model is asked to copy a list of rules. The
generator node needs **no instruction template at all**: a graph agent node receives its
input model as JSON user content, so the rules are already in front of the model `[L1.28]`.
Do not write `{AssetGenInput.style_rules}` — a dotted name fails the state-name check and
reaches the model as literal braces, with no error raised.

> ⚠️ **`output_schema` disables tool calling** on an agent. A node cannot have both. This is
> why the scanner is a code node — the extraction agent then never needs a tool.

---

## 5. Repository layout

```
projectsync/
├── config.py                  # Model pin lives here. Asserted at import.
├── main.py                    # FastAPI. Five endpoints.
├── graph.py                   # build_phase1_workflow() factory. Never a module variable.
├── models.py                  # The six Pydantic models above.
├── nodes/
│   ├── scanner.py             # CODE  — httpx, filters, payload budget
│   ├── extraction.py          # AGENT — output_schema=ExtractedMetadata
│   ├── style_rules.py         # CODE  — reads ACTIVE rules, returns AssetGenInput
│   ├── generator.py           # AGENT — rules arrive on the input model, not a template
│   ├── evaluator.py           # AGENT — temperature=0.0
│   └── persist.py             # CODE  — Firestore write, PENDING_APPROVAL
├── sync/
│   └── github.py              # Both commits. Upsert, not create.
├── memory/
│   └── curator.py             # rule_curator_agent — proposes rules from edits
├── static/                    # Dashboard. No message thread, no send button.
├── tests/
│   ├── conftest.py
│   ├── test_nodes.py
│   └── test_style_rules_change_output.py   # The test that catches memory theatre.
├── Dockerfile
├── pyproject.toml             # Dependencies and the ruff rule list. No requirements.txt.
├── uv.lock                    # Committed. The image installs from this file.
└── README.md                  # Clone to working request in under 10 minutes.
```

The graph must be built by a factory function. A module-level `Workflow` can bind a node
twice on a second import.

---

## 6. Endpoints

| Method | Path | Does |
|---|---|---|
| `POST` | `/api/v1/trigger-sync` | Runs the Phase 1 graph. Returns a transaction id |
| `GET` | `/api/v1/transactions/{id}` | Polled status. **Not a stream** — graph workflows do not support live streaming `[L1.20]` |
| `POST` | `/api/v1/regenerate-asset` | Re-runs generation with current rules. No re-scan |
| `POST` | `/api/v1/approval-callback` | Phase 2. Both commits, both flags, then `COMPLETED` |
| `POST` | `/api/v1/rules/{id}` | Toggle a style rule `ACTIVE` / `INACTIVE` |

`/regenerate-asset` shares the `AssetGenInput` contract with the graph, so there is one code
path for generation, not two.

---

## 7. Deployment

### `Dockerfile`

This is the file that is in the repository. `uv` reads `uv.lock`, so the image gets the
same versions as the development machine.

```dockerfile
# The interpreter is Python 3.12 — the same version as the development machine.
FROM python:3.12-slim

# Copy the `uv` binary from the official image. This is faster than a `pip install
# uv` step, and it needs no network call at build time.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/usr/local

# Install the dependencies before the source code. Docker then keeps this layer in
# the cache while only the source code changes.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-install-project --no-dev

COPY . .

# Cloud Run gives the port in the PORT variable. The default is 8080.
ENV PORT=8080
EXPOSE 8080

# One worker for each container. Cloud Run makes more containers when the load goes
# up, so a second worker inside one container gives no benefit.
CMD ["sh", "-c", "uv run --no-sync uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
```

One stage, not two. `uv sync --no-dev` puts no build tools in the image, so a second
stage would remove nothing. There is no `gcc` step: every dependency ships a wheel for
this platform.

`.dockerignore` carries the security weight here. The `COPY . .` line above would
otherwise put `.env`, `.venv/`, and any key file into a layer — and a secret in a layer
stays in that layer, because a later `RUN rm` cannot reach it.

> **Remaining hardening: the image runs as root.** Add a system user and a `USER` line
> before the deploy. Cloud Run does not need root, and the architecture criterion reads
> the Dockerfile.

### Enable four APIs, not seven

```bash
gcloud services enable \
  aiplatform.googleapis.com \
  run.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com
```

No `pubsub.googleapis.com`. No `gmail.googleapis.com`.

### Deploy

```bash
gcloud run deploy projectsync \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --timeout 300 \
  --set-env-vars GOOGLE_GENAI_USE_VERTEXAI=True,GOOGLE_CLOUD_PROJECT=$GOOGLE_CLOUD_PROJECT,GOOGLE_CLOUD_LOCATION=global,MODEL_ID=gemini-3.7-flash,PORTFOLIO_DATA_REPO=$PORTFOLIO_DATA_REPO,SYNCED_DOCS_PATH=docs/synced,FIRESTORE_TRANSACTIONS=projectsync_transactions \
  --set-secrets GITHUB_TOKEN=github-token:latest
```

`--timeout 300` is enough because **Phase 1 does not wait for a human.** It writes
`PENDING_APPROVAL` and returns. That is the entire reason the two-phase split exists.

**Deploy a trivial container in week one, before the agent works.** IAM and billing problems
are cheap to find early and expensive to find on Aug 30.

### Environment

Canonical set — this is the same block as
[research/adk_api_cheatsheet_notes.md](../research/adk_api_cheatsheet_notes.md) `.env.example`.
Do not invent alternative names.

```bash
# These three are read by the GenAI SDK itself. The names are fixed — an invented
# name like USE_VERTEX_AI is silently ignored and the SDK still calls the direct API.
GOOGLE_GENAI_USE_VERTEXAI=True
GOOGLE_CLOUD_PROJECT=projectsync-<suffix>
GOOGLE_CLOUD_LOCATION=global          # A model 404 means correct this, not the model name.  [L2.7]

MODEL_ID=gemini-3.7-flash             # Below 3.5 is elimination in Stage One.  [L2.3, L3.6]

GITHUB_TOKEN=ghp_...                  # Scope "repo". Must read and write.
PORTFOLIO_DATA_REPO=<user>/portfolio-data
SYNCED_DOCS_PATH=docs/synced          # Keeps generated files apart from plan files.
FIRESTORE_TRANSACTIONS=projectsync_transactions
DASHBOARD_BASE_URL=https://...run.app

# Local development only.
FIRESTORE_EMULATOR_HOST=localhost:8080
```

For local work set `GOOGLE_GENAI_USE_VERTEXAI=False` and supply `GOOGLE_API_KEY` instead —
that is the SDK's documented direct-API path.

---

## 8. Phase gates

Full day-by-day: [stack_and_timeline_engineering.md](stack_and_timeline_engineering.md).

| Phase | Days | Gate — do not pass until this is true |
|---|---|---|
| **1** Core loop | Aug 16–22 | The graph runs end to end locally and produces four assets plus a path recommendation. Model pin asserted. A trivial container is live on Cloud Run |
| **2** Phase 2 + memory | Aug 23–27 | Two commit SHAs from one approval click. Toggling a rule provably changes the next draft. Every step in the §9 fallback matrix has a fallback |
| **3** Proof + submit | Aug 28–31 | Video recorded with console proof. Rules page re-read against frozen code. Write-up published, post tagged. Submitted with hours to spare |

---

## 9. Verification

```bash
# 1. Libraries present, and ADK is 2.x — not 1.x.
python -c "import google.adk, google.genai, google.cloud.firestore, pydantic; \
           print(google.adk.__version__)"          # Expect 2.7.0

# 2. Model pin is at or above the mandated floor.
python -c "from config import MODEL; assert MODEL.startswith('gemini-3.7'), MODEL; print(MODEL)"

# 3. Tests. The style-rule test is the one that matters most.
pytest tests/ -v
pytest tests/test_style_rules_change_output.py -v   # Must FAIL if rules are ignored.

# 4. Container builds and answers.
docker build -t projectsync:test .
docker run --rm -d -p 8080:8080 --name ps-test projectsync:test
curl -f http://localhost:8080/healthz || exit 1
docker stop ps-test
```

Check 3 is the one that separates a working learning loop from a convincing demo of one.
A test that only asserts "generation succeeded" cannot tell the difference.

### Open, unresolved

| Item | Resolve by |
|---|---|
| ADK import paths for `Workflow`, `Agent`, `Event` — package not installed locally `[L1.7]` | Day 1, first hour |
| GCP credit amount and request deadline both unsourced `[L3.14]` | Re-check the rules page. Do not plan around either |
| Cold-start latency on Cloud Run unmeasured | First demo rehearsal |

_Last updated: 2026-08-16_
