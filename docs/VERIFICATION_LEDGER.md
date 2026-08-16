# Verification Ledger

Every load-bearing technical and competition claim in `docs/`, checked against a primary source.
Verified: 2026-08-16 · Verifier: Claude Opus 5 · Method: official docs + PyPI + Devpost rules page

Legend: ✅ confirmed · ❌ false, corrected · ⚠️ true but incomplete/risky · ⬜ not verified this pass

---

## 1. ADK API surface

| # | Claim | Verdict | Source |
|---|---|---|---|
| 1.1 | `google-adk` latest version is **2.7.0** | ✅ | [PyPI](https://pypi.org/pypi/google-adk/json) |
| 1.2 | ADK 2.0 introduced incompatible changes; 2.0 sessions readable by 1.28+ but not older 1.x | ✅ | PyPI README |
| 1.3 | `Workflow(name=..., edges=[...])` exists — `from google.adk import Workflow` | ✅ **real, Python v2.0.0+** | [adk.dev/graphs](https://adk.dev/graphs/) |
| 1.4 | Graph nodes may be `Agent` instances, **plain Python callables**, or tools. A bare function dropped into an `edges` tuple *is* a node — no wrapper needed | ✅ | adk.dev/graphs |
| 1.5 | Edge grammar: sequential chain as one tuple `("START", a, b, c)`; `"START"` is the literal entry node | ✅ | adk.dev/graphs |
| 1.6 | Conditional dispatch: `(router, {"BUG": handler, ...})` matched against `Event(route=[...])` | ✅ | adk.dev/graphs |
| 1.7 | Full `Workflow` constructor signature beyond `name=` / `edges=` | ⚠️ **not published** — treat `Workflow(name=, edges=)` as documented minimum, not the complete API | adk.dev/graphs |
| 1.8 | `SequentialAgent` still exists — `from google.adk.agents.sequential_agent import SequentialAgent` | ✅ | [sequential-agents](https://adk.dev/agents/workflow-agents/sequential-agents/) |
| 1.9 | `SequentialAgent` is **removed** in ADK 2.0 | ❌ **false.** Verbatim: *"Starting in ADK 2.0 for Python and Go, templated workflows have been superseded by more flexible workflow structures, including graph-based workflows and dynamic workflows."* Superseded ≠ deprecated ≠ removed. The word "deprecated" appears nowhere | sequential-agents |
| 1.10 | ADK has **no** built-in way to pause for human input | ❌ **false.** `RequestInput` exists: `from google.adk.events import RequestInput`. A node becomes a HITL node by `yield RequestInput(...)` instead of returning. Options: `message`, `payload`, `response_schema` | [graphs/human-input](https://adk.dev/graphs/human-input/) |
| 1.11 | `RequestInput` pause survives a process restart | ⚠️ **undocumented.** Page describes only the in-graph mechanism (interrupt event + ID + re-invocation). Durability depends on the session persistence layer. **Do not assume cross-restart durability** — this is the real reason Phase 2 stays in FastAPI | graphs/human-input |
| 1.12 | `RequestInput` auto-coerces the human's reply into `response_schema` | ❌ **false.** Docs: it *"does not automatically reformat human responses to fit a specified data structure."* Collect structured input via the UI or normalise with an agent node | graphs/human-input |
| 1.13 | Inter-node data flow is via `Event`: `output` (payload to next node), `message` (user-facing), `state` (session-persisted), `route` (edge selection) | ✅ | [graphs/data-handling](https://adk.dev/graphs/data-handling/) |
| 1.14 | A node may emit **only one** `Event.output` payload per execution — two `yield`s carrying `output` raise a runtime error | ✅ **hard constraint** | graphs/data-handling |
| 1.15 | Pydantic models pass between nodes; successor declares the model as its input type | ✅ | graphs/data-handling |
| 1.16 | `input_schema=` / `output_schema=` accept Pydantic classes on Agent nodes. Instruction templating: `{Model.field}`, or `<Model.field from producing_node>` to qualify by producer | ✅ | graphs/data-handling |
| 1.17 | `output_schema` disables tool calling | ✅ *"the agent cannot use tools when OutputSchema is set"* | graphs/data-handling |
| 1.18 | Session state is a **lightweight** key-value store — not for large payloads. Prefixes: `app:`, `user:`, `temp:`, bare = session | ✅ | graphs/data-handling |
| 1.19 | `Runner(agent=, app_name=, session_service=)` + `runner.run_async(user_id=, session_id=, new_message=)`; `InMemoryRunner` for dev | ✅ | `/adk-cheatsheet` |
| 1.20 | Graph workflows do **not** support live streaming; some third-party integrations may be incompatible | ⚠️ **known limitation** | adk.dev/graphs |
| 1.21 | An **agent** node receives the predecessor payload differently from a code node — *"the predecessor's event.Output is delivered as the agent's user content"*, with no parameter binding. `input_schema` does the coercion | ✅ **new 2026-08-16** | [graphs/data-handling](https://adk.dev/graphs/data-handling/) |
| 1.22 | A bare `{state_key}` in an instruction resolves inside a graph agent node | ❌ **false — and it was in our plan.** Brace-templating in a graph agent node selects from the **input schema**: `{Model.field}`, or `<Model.field from node>`. Bare-key interpolation is the *prebuilt* `SequentialAgent`/`ParallelAgent`/`LoopAgent` + `OutputKey` mechanism: *"the framework substitutes `state["key"]` into the prompt."* Two different models — do not mix. **Consequence:** `{style_rules}` would have rendered as literal text and the memory system would have looked functional while doing nothing. Fixed with the `attach_style_rules` code node | graphs/data-handling |
| 1.23 | Multiple `yield`s from one node are always an error | ⚠️ **more precise than 1.14.** Multiple yields are legal — *"Each yield call adds to a list of data objects on the Event"* — and extra yields carrying only `message` or `state` are fine. The error is specifically *"two or more yield commands with an Event.output."* A bare `return`/`yield` *"passes a `None` value to the next node"* | graphs/data-handling |
| 1.24 | ADK ships a durable Firestore-backed session service, so a graph pause could survive a restart | ⚠️ **true but Java only.** `FirestoreSessionService` (`com.google.adk.sessions`) + `FirestoreDatabaseRunner`, artifact `google-adk-firestore-session-service`. **No documented Python equivalent.** This closes the obvious objection to the Phase 2 decision: on Python there is no supported route to a durable cross-restart pause | [firestore-session-service](https://adk.dev/integrations/firestore-session-service/) |
| 1.25 | Built-in tool import form: `from google.adk.tools.load_web_page import load_web_page` (instance, not module) | ✅ | `/adk-dev-guide` |
| 1.26 | The offline `/adk-cheatsheet` reference files are a valid source for graph APIs | ❌ **false.** `docs-index.md` contains `agents/workflow-agents/*` and **zero `/graphs/*` entries** — it is a pre-2.0 mirror on the retired `google.github.io` host. Still good for `Agent` signatures, `generate_content_config`, `Runner`. Not for anything graph-shaped | inspected 2026-08-16 |
| 1.27 | Doc host: every `google.github.io/adk-docs/*` URL 301-redirects to `adk.dev/*`. Append `/index.md` for raw markdown | ✅ | observed |

## 2. Gemini models

| # | Claim | Verdict | Source |
|---|---|---|---|
| 2.1 | "Gemini 3.5" is invented | ❌ **false — it is real.** `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.5-live-translate-preview` all exist. No Gemini 3.5 **Pro** | [ai.google.dev/models](https://ai.google.dev/gemini-api/docs/models) |
| 2.2 | Current **stable** Flash IDs: `gemini-3.7-flash` (newest), `gemini-3.6-flash`, `gemini-3.5-flash` (docs call it *"our legacy Flash model"*), `gemini-3.5-flash-lite` | ✅ | ai.google.dev |
| 2.3 | `gemini-3-flash-preview` satisfies the hackathon model rule | ❌ **FALSE — SUBMISSION BLOCKER.** It is Gemini **3** Flash, below the mandated "Gemini 3.5 or newer" floor. Stage One judging is pass/fail on completeness | cross-ref 2.2 × 3.2 |
| 2.4 | `gemini-3-pro-preview` is an available fallback | ❌ **false — shut down**, per the "Previous models" list | ai.google.dev |
| 2.5 | `gemini-flash-latest` is a distinct model | ❌ it is an **alias** convention pointing at the latest release of a variation; swapped on each release with 2-week breaking-change notice. Avoid pinning a moving alias for a judged submission | ai.google.dev |
| 2.6 | **Decision (2026-08-16):** pin `gemini-3.7-flash` — newest stable, comfortably above the floor, no preview-deprecation risk during the Sept 1 – Oct 1 judging window | ✅ locked by user | this session |
| 2.7 | A 404 on a model is usually a `GOOGLE_CLOUD_LOCATION` problem, not a model-name problem — fix the location, never the model name | ✅ | `/adk-dev-guide` |

## 3. Hackathon rules

| # | Claim | Verdict | Source |
|---|---|---|---|
| 3.1 | Submission deadline **Aug 31, 2026, 5:00 PM PT** | ✅ | [rules](https://allthingsagentichackathon.devpost.com/rules) |
| 3.2 | Mandatory stack, verbatim: *"Gemini 3.5 or newer accessed through Gemini API or Vertex AI"* **AND** *"at least one Google Agent Framework: Google ADK, GenAI SDK, Antigravity SDK or GenKit"* **AND** *"at least one Google Cloud infrastructure service (such as Cloud Run, Cloud SQL, Firestore, GKE, Pub/Sub)"* | ✅ | rules |
| 3.3 | Tracks: **Taskmaster**, **Collaborative Partner**, **Fortified Enterprise Fleet** | ✅ | rules |
| 3.4 | Rules page shows mismatched track names ("Continuous Action Engine" etc.) — flagged as a live "Known Issue" in `hackathon_rules.md` | ❌ **stale.** Current page shows the three correct track names. Drop the note | rules |
| 3.5 | Judging: Innovation & Operational Utility **40%**, Architectural Discipline & Tech Stack **30%**, Demo & Production Readiness **30%** | ✅ | rules |
| 3.6 | **Stage One is a pass/fail completeness check** before any scoring | ✅ **new — docs omitted this.** This is what makes 2.3 fatal rather than cosmetic | rules |
| 3.7 | Stage Three bonuses: **+0.2** published build write-up, **+0.2** social post tagged `#AllThingsAgenticHackathon`, **+0.2 per extra Google AI model** (Gemma, Veo, Lyria) capped at **+0.6**. Max final score **6** | ✅ **new — docs omitted entirely.** Up to +1.0 of free score | rules |
| 3.8 | Architectural Discipline is scored on decoupling, state management, and *"design failure-tolerant agents"* | ✅ — directly validates spec §9 fallback matrix as **scored**, not polish | rules |
| 3.9 | Total cash pool **$180,000** | ✅ | [devpost](https://allthingsagentichackathon.devpost.com/) |
| 3.10 | Prize breakdown in `hackathon_rules.md` (1st/2nd/3rd per track; "Best Use of ADK $10,000"; "Best Use of Gemini API $10,000") | ❌ **fabricated.** Actual: Grand **$50K**; three category prizes **$20K** each; Startup Excellence **$20K**; 2 × Individual/Hobbyist **$10K**; 2 × Best Architectural Design **$5K**; 2 × Best Multimodal UX **$5K**; 5 × Honorable Mention **$2K**. Plus **$24,500** GCP credits. One prize per project | devpost |
| 3.11 | Submission window opens **Aug 3, 2026, 9:00 AM PT** | ⚠️ docs said Aug 4 — minor, corrected | rules |
| 3.12 | Judging **Sept 1 – Oct 1, 2026**; winners announced **on or around Oct 8, 2026** | ✅ **new — docs said "TBD"** | rules |
| 3.13 | Nigeria eligible; solo or team ≤ 5; one track only | ⬜ **not re-verified this pass** — carried from the 2026-08-10 check |
| 3.14 | $150 GCP credit request, deadline Aug 28 12:00 PM PT | ⬜ **per-participant amount unverified.** Confirmed only that a **$24,500** credit pool exists across the event. Treat the $150 figure and the deadline as unconfirmed until re-checked |

## 4. Libraries and GCP

| # | Claim | Verdict | Source |
|---|---|---|---|
| 4.1 | `create_file(path, message, content, branch=NotSet, committer=NotSet, author=NotSet)` → `{'content': ContentFile, 'commit': Commit}`. `PUT /repos/{owner}/{repo}/contents/{path}` | ✅ | [PyGithub](https://pygithub.readthedocs.io/en/stable/github_objects/Repository.html) |
| 4.2 | `update_file(path, message, content, sha, branch=, committer=, author=)` — **`sha` is required** (blob SHA of the file being replaced) | ✅ | PyGithub |
| 4.3 | Correct upsert flow: `get_contents(path)` → if it resolves, take its blob sha → `update_file`; else `create_file` | ✅ | PyGithub |
| 4.4 | Exception raised by `get_contents` on a missing path | ⬜ **not documented on that page.** Confirm empirically before relying on it for control flow |
| 4.5 | Commit SHA is returned, so the "provable closed loop" claim holds | ✅ | 4.1 |
| 4.6 | Firestore query form: `.where(filter=FieldFilter("f", ">", v)).order_by("f", direction=firestore.Query.DESCENDING).limit(n)` → `.stream()`. Imports: `from google.cloud import firestore`, `from google.cloud.firestore_v1.base_query import FieldFilter` | ✅ current documented form | [Firestore docs](https://docs.cloud.google.com/firestore/docs/query-data/order-limit-data) |
| 4.7 | `order_by()` **filters for existence** — documents missing the field are silently excluded. Rule Curator recency query must guarantee every transaction row has the sort field | ✅ **gotcha** | Firestore docs |
| 4.8 | An inequality filter implies ordering on that field, and it must be the **first** ordering | ✅ **gotcha** | Firestore docs |
| 4.9 | Positional `.where("f", ">", v)` deprecation status | ⬜ page uses only the `filter=` keyword form; deprecation not stated. Use `filter=FieldFilter(...)` |
| 4.10 | Cost estimate "$30–50 Cloud Run + $5 Firestore + $10 Vertex AI = $50" | ⬜ **unverified estimate**, not a quote. Keep labelled as an estimate |

---

## Open items

- **4.4** — probe `get_contents` on a missing path during Day-1 build; the upsert branch depends on it.
- **3.13 / 3.14** — re-check eligibility and the credit figure directly on the rules page before requesting credits.

## Resolved since first pass

- **1.7** — **resolved 2026-08-16 by reading the installed `google-adk` 2.7.0.** `Workflow` fields: `name, description, rerun_on_resume, wait_for_output, retry_config, timeout, input_schema, output_schema, state_schema, edges, max_concurrency, graph`. Three findings were build-blocking and are recorded as **1.28–1.30** below.
- **1.11 / 1.24** — "could a durable session service make `RequestInput` viable?" Answered: not on Python. `RequestInput` lives in `google.adk.events` and is an **event payload, not a node type**; the pause is a `adk_request_input` long-running function call whose state lives in session history. Python ships `InMemorySessionService`, `DatabaseSessionService`, and `VertexAiSessionService` only — no Firestore session service. `DatabaseSessionService` would add a third GCP service. Phase 2 stays plain FastAPI, for this reason and not the one the spec first gave.
- **1.22** — the `{style_rules}` templating question. First answered from the docs, then **corrected on 2026-08-16 from the source**. See **1.28**; the first answer's replacement advice was wrong.
- **Graph initial input** — resolved. `Runner.run_async(new_message=...)` sends `types.Content`, which does **not** coerce into a Pydantic model, so the entry node cannot take a `node_input` parameter. Pass the request through `run_async(state_delta={...})` and bind the entry node's parameters from state by name. This is what `nodes/scanner.py` does.
- **`Agent` import path** — resolved. `from google.adk import Agent` works; `Agent` is re-exported from `google.adk.agents.llm_agent`. `LlmAgent`, `SequentialAgent`, `RequestInput`, and `InMemoryRunner` are **not** top-level exports. `Context` is.

## Corrections found by reading the installed package (2026-08-16)

These three were each capable of costing a build day. All were read out of
`.venv/Lib/site-packages/google/adk/`, not from a document.

| # | Claim as documented | What the source says | Where |
|---|---|---|---|
| 1.28 | Instruction templating uses `{Model.field}`; a bare `{state_key}` does not resolve in a graph agent node | **Backwards.** `_is_valid_state_name` accepts only a valid Python **identifier**, or an identifier behind `app:`/`user:`/`temp:`. `{style_rules}` resolves if that key is in state; `{AssetGenInput.style_rules}` does **not** — a dot fails the check and the token is returned unchanged, so the braces reach the model as literal text. `{artifact.name}` is the one dotted form. No exception is raised either way. **A graph agent node needs no template at all**: `prepare_llm_agent_input` calls `to_user_content(node_input)`, which is `model_dump_json()` for a `BaseModel`, appends it as a user event, and forces `include_contents='none'` so `_get_current_turn_contents` anchors on exactly that event. | `utils/instructions_utils.py:159,238-260`; `utils/content_utils.py:60-80`; `workflow/_llm_agent_wrapper.py:301-333,386-388`; `flows/llm_flows/contents.py:93-121,995-1022` |
| 1.29 | `Edge(from_node="START", to_node="node_name")` | **Does not run — but only in this form.** `START` is a `BaseNode` instance with `name='__START__'`; `START == "START"` is `False`. `Edge.from_node` and `Edge.to_node` are typed `Annotated[BaseNode, SerializeAsAny()]`, so a string in the **`Edge` constructor** raises a Pydantic validation error. Import the object: `from google.adk.workflow import START`. **The string is legitimate in the tuple chain form.** `ChainElement` resolves to `NodeLike`, and `NodeLike` is `BaseNode \| BaseTool \| Callable \| Literal["START"]`; `_get_or_build_node` opens with `if node_like == "START": return START`. So `Workflow(edges=[("START", scan_node), ...])` is correct code. Only mix the two forms with care: this project uses `Edge` objects throughout, so it must use the `START` object. | `workflow/_graph.py:30-110`, `workflow/utils/_graph_parser.py::_get_or_build_node` |
| 1.30 | A code node needs `parameter_binding="node_input"` to read its predecessor | **Inverted.** The default is `'state'`, and that is what a chain node wants: a parameter named exactly `node_input` receives the predecessor's output (coerced by `TypeAdapter`), every other parameter is looked up in `ctx.state` **by name**, and a `Context`-annotated parameter receives the context. A missing parameter with no default raises `ValueError: Missing value for parameter ...` — it does not silently vanish. `'node_input'` mode destructures the payload parameter-by-parameter, "used when the node acts as an agent's tool." | `workflow/_function_node.py::_bind_parameters` |

Two further findings that simplify the build rather than block it:

- **`RetryConfig` and `timeout` are native fields** on both `Agent` and `Workflow` (`RetryConfig(max_attempts, initial_delay, max_delay, backoff_factor, jitter, exceptions)`). The §9 fallback matrix is declarative configuration, not hand-rolled retry code — and failure tolerance becomes visible in the graph definition, which is what the architecture criterion scores `[L3.8]`.
- **`output_key` fires in graph mode.** `_llm_agent_wrapper.py:362-363` writes `ctx.actions.state_delta[agent.output_key] = output`. This is how `persist_transaction` gets the metadata and the assets, which the intervening evaluator node does not carry.

_Last updated: 2026-08-16_
