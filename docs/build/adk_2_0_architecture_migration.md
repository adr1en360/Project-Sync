# ADK 2.0 Graph Architecture — ProjectSync Build Reference

_Updated: 2026-08-16 · Build-time source of truth for ADK patterns. Read before writing agent code._
_Every API claim here is checked in [VERIFICATION_LEDGER.md](../VERIFICATION_LEDGER.md) §1. Ledger IDs cited inline as `[L1.x]`._

## Purpose

ADK 2.0 (current: **2.7.0** on PyPI `[L1.1]`) adds a first-class **graph engine**: `Workflow`, built from `edges`. ProjectSync Phase 1 is built on it. This file maps the spec onto verified ADK 2.0 APIs.

> **Correction to the previous version of this file.** It claimed `SequentialAgent` was removed and that importing it raises `ImportError`. **Both were wrong.** `SequentialAgent` still exists and still works — ADK's own words are that templated workflows have been *"superseded by more flexible workflow structures"* `[L1.8, L1.9]`. Superseded, not deleted.
>
> We use the graph anyway, by decision on 2026-08-16, for a reason that survives scrutiny: the graph lets `scan_github_repository` and the Firestore persist step be **real nodes in one declared pipeline** `[L1.4]` instead of plain code bolted on either side of an agent run. That is a materially better answer to the 30%-weighted "decouple systems, manage state" criterion.

---

## 1. Verified API Reference

| Concept | Verified API | Ledger |
|---|---|---|
| Graph pipeline | `from google.adk import Workflow` → `Workflow(name=..., edges=[...])` | `[L1.3]` |
| Sequential chain | One tuple: `("START", node_a, node_b, node_c)`. `"START"` is the literal entry node | `[L1.5]` |
| Conditional branch | `(router_node, {"KEY": node_x, "OTHER": node_y})` matched against `Event(route=...)` | `[L1.6]` |
| LLM node | `Agent(name=, model=, instruction=, input_schema=, output_schema=)` | `[L1.16]` |
| Deterministic code node | **A plain Python callable dropped into the `edges` tuple.** No wrapper, no decorator | `[L1.4]` |
| Pass data to next node | `return Event(output=value)`, or plain `return value` | `[L1.13]` |
| Receive previous output — **code node** | Declare it as the node's input parameter: `def persist(node_input: PathRecommendation)` | `[L1.13]` |
| Receive previous output — **agent node** | **No parameter binding.** The predecessor's `Event.output` arrives as the agent's *user content*; `input_schema` coerces it | `[L1.21]` |
| Instruction templating | `{Model.field}`, or `<Model.field from producing_node>` to qualify by producer. A bare `{state_key}` is the *prebuilt-agent* `output_key` form and does **not** apply here | `[L1.16, L1.22]` |
| Session state | `Event(state={"k": v})` to write; `ctx.state` to read. Not for large payloads | `[L1.13, L1.18]` |
| Human-input node | `from google.adk.events import RequestInput` → `yield RequestInput(message=, payload=, response_schema=)` | `[L1.10]` |
| Execution | `Runner(agent=wf, app_name=, session_service=)` + `await runner.run_async(...)`; `InMemoryRunner` for dev | `[L1.19]` |

### Hard constraints — these will bite

| Constraint | Consequence for ProjectSync | Ledger |
|---|---|---|
| **A node may emit only ONE `Event.output` per execution.** Two `yield`s carrying `output` raise a runtime error | `AssetGeneratorAgent` must return **one** `GeneratedAssets` model containing all four outputs — never four separate emissions | `[L1.14]` |
| `output_schema` **disables tool calling** on that agent | Fine here: all three agents are pure reasoning. The scan is a code node, not a tool | `[L1.17]` |
| `order_by()` in Firestore filters for field existence — rows missing the field vanish from results | Every transaction row **must** be written with `created_at`, or the Rule Curator query silently skips it | `[L4.7]` |
| Graph workflows do **not** support live streaming | Don't promise streamed progress in the dashboard or demo | `[L1.20]` |
| `RequestInput` does **not** coerce the reply into `response_schema` | Irrelevant to us — Phase 2 is FastAPI. Noted so it isn't mistaken for validation | `[L1.12]` |
| `Workflow`'s full constructor signature is unpublished | Only `name=` and `edges=` are documented. Read the real signature off the installed package on Day 1 | `[L1.7]` |
| A bare `{state_key}` does not resolve in a graph agent node | Style rules must arrive on the **input model**, via the `attach_style_rules` code node — not as a bare state key | `[L1.22]` |
| ADK's durable Firestore session service is **Java only** | There is no Python path to a session that survives a restart. This is the load-bearing reason Phase 2 is FastAPI + Firestore | `[L1.24]` |

### Code style

All comments and docstrings in this project are written in **ASD-STE100 Simplified Technical English**: approved vocabulary, active voice, imperative mood for instructions, one instruction per sentence, simple tenses, no `-ing` verb forms, ≤20 words per procedural sentence, no noun clusters over three words. Markdown prose is normal technical English. Worked examples: [research/adk_api_cheatsheet_notes.md](../research/adk_api_cheatsheet_notes.md).

### Claims from the old file that did NOT survive verification

| Old claim | Status |
|---|---|
| `SequentialAgent` removed; importing it raises `ImportError` | ❌ False `[L1.8, L1.9]` |
| "Output key of a function node = function name by default" | ❌ **Unverified and contradicted.** Graph data flow is `Event.output` → successor's declared input parameter `[L1.13]`. Do not rely on implicit function-name keying |
| Function nodes need `tool_context: ToolContext` as last parameter | ❌ **Unverified for graph nodes.** `ToolContext` is a *tool* API. Graph nodes receive the predecessor's payload as a parameter `[L1.13]` |
| `output_key=` on every node for auto-save | ⚠️ `output_key` is real for template/LLM agents, but graph nodes hand off via `Event.output`. Don't mix the two models |
| `get_fast_api_app` from `google.adk.cli.fast_api` | ⬜ **Unverified.** ProjectSync needs three custom endpoints anyway — use plain FastAPI + `Runner`. Revisit only if a reason appears |
| ADK v2.6.3 is current | ❌ 2.7.0 `[L1.1]` |

---

## 2. Phase 1 — The Graph

```
project_sync_phase1 = Workflow(
    name="project_sync_phase1",
    edges=[("START", scan_github_repository,
                     extraction_agent,
                     attach_style_rules,
                     asset_generator_agent,
                     path_evaluator_agent,
                     persist_transaction)],
)

  ┌──────────────────────────┐
  │ scan_github_repository   │  [CODE NODE — no LLM]
  │ httpx → GitHub REST      │  README, dependency manifests, top-10 most-modified
  │ in:  repo_url: str       │  files by commit count, last 25 commits, tree shape
  │ out: RepoScan            │
  └────────────┬─────────────┘
               ▼
  ┌──────────────────────────┐
  │ extraction_agent         │  [LLM] gemini-3.7-flash
  │ in:  RepoScan            │  input_schema=RepoScan
  │ out: ExtractedMetadata   │  output_schema=ExtractedMetadata
  └────────────┬─────────────┘
               ▼
  ┌──────────────────────────┐
  │ attach_style_rules       │  [CODE NODE — no LLM]
  │ Firestore read: ACTIVE   │  Rules read HERE, at generation time — not at scan
  │ in:  ExtractedMetadata   │  time. No LLM is asked to copy the rule list through.
  │ out: AssetGenInput       │  = ExtractedMetadata + style_rules
  └────────────┬─────────────┘
               ▼
  ┌──────────────────────────┐
  │ asset_generator_agent    │  [LLM] gemini-3.7-flash, temp 0.7
  │ in:  AssetGenInput       │  instruction reads {AssetGenInput.style_rules}
  │ out: GeneratedAssets     │  ONE model, four fields  [L1.14]
  └────────────┬─────────────┘   doc_sheet_md · portfolio_card · resume_bullets · social_post
               ▼
  ┌──────────────────────────┐
  │ path_evaluator_agent     │  [LLM] gemini-3.7-flash, temperature 0.0
  │ in:  GeneratedAssets     │  FULL_PUBLISH | PRIVATE_ONLY
  │ out: PathRecommendation  │  "safe to show a stranger", not "code works"
  └────────────┬─────────────┘
               ▼
  ┌──────────────────────────┐
  │ persist_transaction      │  [CODE NODE]
  │ Firestore write:         │  status=PENDING_APPROVAL, created_at=SERVER_TIMESTAMP
  │ projectsync_transactions │  created_at is MANDATORY  [L4.7]
  └──────────────────────────┘
```

**Style rules injection — resolved 2026-08-16, was an open Day-3 question.** The earlier plan put `{style_rules}` in the generator's instruction as a bare state key. **That form does not resolve in a graph agent node.** Bare-key interpolation is the *prebuilt* `SequentialAgent`/`LoopAgent` + `output_key` mechanism; graph agent nodes have exactly two documented forms, `{Model.field}` and `<Model.field from producing_node>` `[L1.16, L1.22]`. Left unfixed, the rules would have rendered as literal text and the memory system would have *looked* functional while doing nothing — the worst class of bug in a demo.

The fix is the `attach_style_rules` code node above. It also happens to be the better design, which is the tell that it's right:

- Rules are read **at generation time**, so a toggle takes effect on the very next Regenerate — which is exactly the behaviour spec §5 promises.
- No LLM is asked to copy a list of rules through `ExtractedMetadata`. That would burn tokens and silently drop items.
- `/regenerate-asset` builds an `AssetGenInput` from the stored metadata plus a fresh rule read. **The endpoint and the graph share one contract** instead of two code paths that can drift.

## 3. Phase 2 — FastAPI, outside the graph

Endpoints on a plain FastAPI app:

| Method | Path | Does |
|---|---|---|
| POST | `/api/v1/trigger-sync` | Body `{repo_url}`. Kicks off the Phase 1 graph. Returns 202 + `transaction_id` |
| POST | `/api/v1/approval-callback` | `{transaction_id, decision, edited_assets?, rule_flags?}`. Approve → 2 commits → Rule Curator → `COMPLETED` |
| POST | `/api/v1/regenerate-asset` | Re-runs **`asset_generator_agent` alone** against stored metadata + current `ACTIVE` rules. No re-scan, no re-extraction |
| POST | `/api/v1/rules/{rule_id}/activate` | One click: `PROPOSED` → `ACTIVE` |
| GET | `/api/v1/transactions/{id}` | Dashboard read model |

**Why Phase 2 is not a graph node — the honest reason.** ADK 2.0 *does* have a built-in human-input primitive: `RequestInput` `[L1.10]`. The spec's original justification ("ADK has no built-in agent type for a human decision that may arrive hours or days later") is **factually wrong and must not be repeated to judges** — it is checkable in one page of their docs.

The real reason, which holds up: `RequestInput`'s pause is documented only as an in-graph mechanism — an interrupt event plus an ID, with re-invocation on reply. **Durability across a process restart is not documented anywhere** `[L1.11]`. Cloud Run scales to zero. An approval arriving two days later must survive the instance that created it being long gone.

And the obvious counter has been checked and closed: ADK *does* ship a durable, Firestore-backed session store — `FirestoreSessionService` plus `FirestoreDatabaseRunner`. **It is ADK Java only** (`com.google.adk.sessions.FirestoreSessionService`), with no documented Python equivalent `[L1.24]`. So on a Python build there is no supported route to a graph pause that survives a restart. That requires a durable store keyed by transaction ID — which is Firestore, which is Phase 2. `RequestInput` was evaluated and rejected on state-durability grounds, and saying exactly that is a *stronger* Architectural Discipline answer than not knowing the primitive existed.

## 4. Repository Layout

Source code lives at the **repository root**, not inside `docs/`. `docs/` is planning material.

```
Project Sync/                          ← repo root, this is what judges clone
├── projectsync_agent/
│   ├── __init__.py
│   ├── schemas.py                     RepoScan · ExtractedMetadata · AssetGenInput
│   │                                  GeneratedAssets · PathRecommendation · StyleRule
│   ├── nodes/
│   │   ├── scan_github.py             scan_github_repository()  [CODE NODE]
│   │   ├── style_rules.py             attach_style_rules()      [CODE NODE]
│   │   └── persist.py                 persist_transaction()     [CODE NODE]
│   ├── agents/
│   │   ├── extraction.py
│   │   ├── asset_generator.py
│   │   └── path_evaluator.py
│   ├── workflow.py                    build_phase1_workflow() — factory, never a module global
│   ├── memory/
│   │   ├── rules.py                   live ACTIVE-rule read, PROPOSED→ACTIVE transition
│   │   └── curator.py                 Rule Curator sub-agent (non-blocking)
│   ├── publish/
│   │   └── github_sync.py             PyGithub upsert, two independent targets
│   └── main.py                        FastAPI app + the five endpoints
├── dashboard/                         review UI: 4 tabs, Regenerate, Approve/Discard
├── tests/
├── evals/
│   └── phase1_eval.jsonl
├── deploy/Dockerfile                  python:3.12-slim, non-root
├── docs/                              ← planning docs (this tree)
├── pyproject.toml                     uv-managed
├── .env.example
└── README.md                          judge setup: clone → env → run in <10 min
```

> ⚠️ **Path collision to resolve.** Spec §4 commits the generated doc sheet to the target repo's `/docs/` folder — and the test/demo target repo **is ProjectSync's own repo** (spec §1). Left alone, a demo run writes generated sheets into this same planning-docs tree. **Default adopted: generated sheets go to `docs/synced/`.** Confirm before Day 6.

**Always build the graph in a factory function** (`def build_phase1_workflow(): return Workflow(...)`), never as a module-level global — re-imports otherwise risk duplicate node binding.

## 5. Failure Fallbacks — scored, not polish

Judging explicitly rewards *"design failure-tolerant agents"* `[L3.8]`. Every step writes state to Firestore **before** it can fail, so a retry resumes rather than restarting.

| Step | Failure | Fallback |
|---|---|---|
| Repo scan | Rate limit, network, no access | Retry once with backoff → `FAILED_SCAN` + error text on dashboard |
| `extraction_agent` | Malformed/empty output | Retry once, same input → `FAILED_EXTRACTION` |
| `asset_generator_agent` | Schema violation | Retry once → `FAILED_GENERATION` |
| `path_evaluator_agent` | Any failure | **Default `PRIVATE_ONLY`.** Never publish something that was never scored |
| GitHub commit | Auth, rate limit, conflict | Two independent booleans in the schema. One failing never marks the other done. Retry scoped to the failed piece only — not a re-approval |
| Rule Curator | Any failure | **Non-blocking.** Log, skip the proposal, never delay the approval |

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `404 model 'gemini-3.7-flash' not found` | Wrong `GOOGLE_CLOUD_LOCATION` | Set `global` or `us-central1`. **Never "fix" a 404 by changing the model name** `[L2.7]` — and never drop below 3.5, that is a pass/fail gate `[L3.6]` |
| Runtime error on a node emitting output | Two `yield`s each carrying `output` | One `Event.output` per node execution `[L1.14]`. Bundle into a single model |
| Agent invents tool calls | `output_schema` set on the wrong agent | `output_schema` auto-disables tools `[L1.17]`. Don't also pass `tools=[...]` |
| Successor node gets `None` | Predecessor returned bare `return` | Return the value or `Event(output=value)` `[L1.13]` |
| Rule Curator query returns nothing | Rows missing `created_at`; `order_by` filters for existence | Always write `created_at` `[L4.7]`. Note an inequality filter must be the first ordering `[L4.8]` |
| "Parent agent already bound" | Workflow cached in module globals | Use the `build_phase1_workflow()` factory |
| `ModuleNotFoundError: google.adk` after install | Wrong Python env | `uv run python ...`; `uv sync` first |
| `update_file` fails | Missing blob `sha` | `get_contents(path)` → take its sha → `update_file`; else `create_file` `[L4.2, L4.3]` |

_Last updated: 2026-08-16_
