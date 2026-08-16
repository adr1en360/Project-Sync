# Verification Ledger

Every load-bearing technical and competition claim in `docs/`, checked against a primary source.
Verified: 2026-08-16 · Verifier: Claude Opus 5
Method: official docs + PyPI + the Devpost rules page, then the installed packages in `.venv`, and
then the code in a run. §5 exists because the last of those three found what the first two could not.

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
| 1.16 | `input_schema=` / `output_schema=` accept Pydantic classes on Agent nodes. Instruction templating: `{Model.field}`, or `<Model.field from producing_node>` to qualify by producer | ⚠️ **half true.** The schema half is confirmed. **The templating half is false — see 1.28.** Neither dotted form resolves: the engine has no `<... from ...>` syntax at all, and a dot fails `_is_valid_state_name`. Documented, but wrong | graphs/data-handling, overturned by source |
| 1.17 | `output_schema` disables tool calling | ✅ *"the agent cannot use tools when OutputSchema is set"* | graphs/data-handling |
| 1.18 | Session state is a **lightweight** key-value store — not for large payloads. Prefixes: `app:`, `user:`, `temp:`, bare = session | ✅ | graphs/data-handling |
| 1.19 | `Runner(agent=, app_name=, session_service=)` + `runner.run_async(user_id=, session_id=, new_message=)`; `InMemoryRunner` for dev | ✅ **with the import path.** `InMemoryRunner` is real but is **not** a top-level export: `from google.adk.runners import InMemoryRunner`. `Runner` *is* top-level | `/adk-cheatsheet`; path confirmed against the installed package 2026-08-16 |
| 1.20 | Graph workflows do **not** support live streaming; some third-party integrations may be incompatible | ⚠️ **known limitation** | adk.dev/graphs |
| 1.21 | An **agent** node receives the predecessor payload differently from a code node — *"the predecessor's event.Output is delivered as the agent's user content"*, with no parameter binding. `input_schema` does the coercion | ✅ **new 2026-08-16** | [graphs/data-handling](https://adk.dev/graphs/data-handling/) |
| 1.22 | A bare `{state_key}` in an instruction resolves inside a graph agent node | ⚠️ **true, and this row's own correction was wrong.** The original claim is right: a bare `{style_rules}` *does* resolve, from session state. The correction written here first — "use `{Model.field}` instead" — was read off the published docs and is **false**; see **1.28**, which was read off the source. The `attach_style_rules` code node stands, because it is the better design and not because the template form was the problem: a graph agent node needs **no template at all**. **Read 1.28, not this row** | superseded by 1.28 |
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
| 2.8 | An `output_schema` may hold a free `dict` field | ❌ **false on the Gemini Developer API — this stopped the generator.** A bare `dict` puts `"additionalProperties": true` in the JSON schema, and the direct API raises `ValueError: additionalProperties is only supported in Gemini Enterprise Agent Platform mode`. Vertex AI accepts it; the API-key route does not, and that is the route the README gives. Fix: `GeneratedAssets.portfolio_card` is now the typed `PortfolioCard`, which names the same five keys the generator instruction already asked for | live call, 2026-08-16 · `google/genai/_transformers.py:654` `_raise_for_unsupported_mldev_properties` |
| 2.9 | With the fix, all three `output_schema` models are accepted by the Developer API — `GeneratedAssets`, `ExtractedMetadata`, `PathRecommendation` | ✅ | live call, 2026-08-16 |
| 2.10 | The free tier gives **20 requests per day, per project, per model** for `gemini-3.7-flash` | ✅ **and it is a planning constraint.** From the 429 body: `limit: 20`, `metric: generate_content_free_tier_requests`, `quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier`. One Phase 1 run costs 3 calls and an approval adds a 4th, so 20/day is about **5 complete transactions per day** — for development, rehearsals, and the recording together. The quota is per project, so a second API key does not help | 429 response, 2026-08-16 |
| 2.11 | The numeric free-tier limits are in the public docs | ❌ **not any more.** [ai.google.dev rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits) now says only *"Rate limits ... can be viewed in Google AI Studio"* and *"Specified rate limits are not guaranteed"*. The per-model RPM/TPM/RPD table is gone. Read the live figures at [aistudio.google.com/rate-limit](https://aistudio.google.com/rate-limit); the API's own 429 body is the next best source | ai.google.dev, 2026-08-16 |
| 2.12 | `gemini-3.7-flash` returns intermittent `503 UNAVAILABLE "This model is currently experiencing high demand"`, separate from the quota. In one probe a plain call failed while three schema calls in the same minute succeeded | ⚠️ **transient, and a demo risk.** ADK's `RetryConfig(max_attempts=2)` on the generator node allows one retry, which the specification fixes. Do not record a demo against the free tier | live calls, 2026-08-16 |
| 2.13 | `GOOGLE_GENAI_USE_VERTEXAI` is the current name for the route switch | ⚠️ **deprecated, but it still works — no change needed.** The successor is `GOOGLE_GENAI_USE_ENTERPRISE`. Two independent code paths read both names and both prefer the new one: the GenAI SDK takes `ENTERPRISE` first and warns only when the two conflict; ADK takes `ENTERPRISE` first and raises a `DeprecationWarning` whenever only the old name is present. That warning in a test run is benign. ADK returns `False` if neither name is set | `google/genai/_api_client.py:653-678` · `google/adk/utils/env_utils.py:69-79`, read 2026-08-16 |

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

## 5. The interface

This section exists because of 5.1. Every row above it came from reading a
document or a package. 5.1 came from running the code, and nothing else would
have found it.

| # | Claim | Verdict | Source |
|---|---|---|---|
| 5.1 | The review desk worked in a browser before 2026-08-16 | ❌ **it had never run, once.** The old `static/app.js:134` built `new Intl.DateTimeFormat(undefined, {dateStyle: "medium", timeStyle: "short", timeZoneName: "short"})` at the top level of the module. That mixture is not valid (5.2), so the constructor threw, the module never finished, `boot()` never ran, the masthead stayed at `…`, and no button did anything. The defect passed every earlier check for one reason: **a dead page and a live page give the same HTTP answer.** `curl /` returns the markup, `curl /healthz` returns the health, and every route answers exactly as before. Found by importing the modules under a fake DOM. Fixed in `static/js/sheet.js` with named component options, which give the same text and add the zone: `09:00Z` renders as `Aug 16, 2026, 10:00 AM GMT+1` in Africa/Lagos | probed on node v24.14.0, icu 78.2, 2026-08-16 · fixed at `static/js/sheet.js:28-35` · `tests/desk_harness.mjs` |
| 5.2 | Which options may not go with `dateStyle` or `timeStyle` | ✅ **eleven:** `weekday, era, year, month, day, dayPeriod, hour, minute, second, fractionalSecondDigits, timeZoneName`. The locale options are safe, and `timeZone` is one of them. So `{dateStyle, timeZone: "UTC"}` is valid and `{dateStyle, timeZoneName: "short"}` is not — the two differ by four letters. One point of difference: MDN says the combination "is not valid" and names `RangeError` as the exception of the constructor, and **V8 throws `TypeError: Invalid option : option`.** Five mixtures were probed and all five threw `TypeError`. The class of the error changes nothing here, because either one stops the module | [MDN `Intl.DateTimeFormat()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat), read 2026-08-16 · five mixtures probed the same day |
| 5.3 | A probe of the API is enough to test this product | ❌ **no**, and 5.1 is the proof. Two faults in the interface give a page that does not work and an API that answers correctly: a module that throws at import, and an address with one wrong letter in it. The interface now has four tests of its own. `tests/desk_harness.mjs` imports every module under a fake DOM and reads what they wrote — 81 checks, 12 requests, all eight API paths. Three tests in `tests/test_review_desk.py` hold `index.html` and the files beside it to the same list: every address on the page is a file, every stylesheet is on the page, and the links stay in the order of their numbers. Each of the three was made to fail on purpose before it was kept | `tests/`, added 2026-08-16 · `uv run pytest tests/ -q` → 40 passed, 1 skipped |
| 5.4 | "`@import` sends the downloads one after the other, so ordered `<link>` tags are faster" | ✅ **true, and sourced.** The browser has a preload scanner. It reads the raw HTML as the page arrives and it starts the downloads early. It finds every `<link rel="stylesheet">` in the head at the same time, so those files come together. It cannot find an `@import`, because an `@import` is inside a CSS file and not in the HTML. The browser learns of the second file only after it has the first one and reads it, which makes a request chain and holds the render longer. web.dev says to keep to `<link rel="stylesheet">` for this reason. **This row stood at ⬜ for part of the day, because the first two pages that were read for it were the wrong pages:** MDN's `@import` page carries no performance guidance, and web.dev's render-blocking page does not mention `@import` at all. The guidance is on the preload scanner page. Cost of the 17 links, measured: 2.1 ms each on one kept-alive connection, and a browser opens six | [web.dev, the preload scanner](https://web.dev/articles/preload-scanner), read 2026-08-16 · the two pages that do **not** state it, both read the same day: [MDN `@import`](https://developer.mozilla.org/en-US/docs/Web/CSS/@import), [web.dev render-blocking CSS](https://web.dev/articles/critical-rendering-path/render-blocking-css) · timing measured on 127.0.0.1 |
| 5.5 | Splitting `app.css` into 17 files changed no rule | ✅ the comments and the whitespace were taken out of both sides, and the declarations then matched exactly: 23,953 characters, the same on each side. Order is kept, so the cascade is kept. `@import` is not used, so the cascade order is the order of the links | compared 2026-08-16, before `static/app.css` was deleted. `git show HEAD:static/app.css` gives the original back |

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
