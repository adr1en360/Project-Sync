# ADK Framework Reference Digest — URL Index & Gotchas

_Verified: 2026-08-16 · ADK **2.7.0** (PyPI) · Python_
_Supersedes the 2026-08-14 pass, which was written against v2.6.3 and carried three false claims (see §5)._
_Claim audit: [VERIFICATION_LEDGER.md](../VERIFICATION_LEDGER.md) §1_

## Purpose

Where to look things up. Code to copy lives in [adk_api_cheatsheet_notes.md](adk_api_cheatsheet_notes.md); architecture lives in [build/adk_2_0_architecture_migration.md](../build/adk_2_0_architecture_migration.md).

> ⚠️ **The docs moved.** Every `google.github.io/adk-docs/*` URL now 301-redirects to `adk.dev/*`. Old links in any doc, bookmark, or LLM answer are stale. Append `/index.md` to any `adk.dev` page for the raw-markdown version — much cheaper to read than the rendered page.

---

## 1. The pages that actually matter for ProjectSync

Read 1–4 before writing a line of graph code. They are the whole build.

| # | Page | URL | Why |
|---|---|---|---|
| ⭐1 | Graph-based agent workflows | `https://adk.dev/graphs/index.md` | The engine. `Workflow(name=, edges=[...])`, `"START"`, node types |
| ⭐2 | **Data handling** | `https://adk.dev/graphs/data-handling/index.md` | **The single most load-bearing page.** How data moves between nodes, the one-`Event.output`-per-node rule, and the exact instruction-template syntax. Resolved three of our open questions |
| ⭐3 | Graph routes | `https://adk.dev/graphs/routes/index.md` | Conditional edges via `Event(route=...)`. Needed if PathEvaluator ever branches in-graph |
| ⭐4 | Human input | `https://adk.dev/graphs/human-input/index.md` | `RequestInput`. Evaluated and rejected — read it so the rejection is informed |
| 5 | Cloud Run deploy | `https://adk.dev/deploy/cloud-run/index.md` | Day 13. CLI path vs custom Dockerfile+FastAPI path — we need the custom path |
| 6 | State | `https://adk.dev/sessions/state/index.md` | Scope prefixes `app:` / `user:` / `temp:` |
| 7 | Evaluate + Criteria | `https://adk.dev/evaluate/index.md`, `/evaluate/criteria/index.md` | `adk eval`, evalset schema, LLM-as-judge |
| 8 | Dynamic workflows | `https://adk.dev/graphs/dynamic/index.md` | Not used. Skim only if a node needs to build edges at runtime |
| 9 | Template agent workflows | `https://adk.dev/agents/workflow-agents/index.md` | `SequentialAgent`/`ParallelAgent`/`LoopAgent`. **Superseded, not removed.** Our fallback if the graph fights us |
| 10 | Function tools | `https://adk.dev/tools-custom/function-tools/index.md` | Only if an agent ever needs a real tool. Our three don't — `output_schema` disables tools anyway |

Package + source:

| Resource | URL / command |
|---|---|
| PyPI | `https://pypi.org/project/google-adk/` — **2.7.0** |
| GitHub | `https://github.com/google/adk-python` |
| Installed source (best answer for any ambiguity) | `uv run python -c "import google.adk, inspect; print(inspect.getsourcefile(google.adk.Workflow))"` |

## 2. Offline copies on this machine

Both exist and are identical; prefer the `.claude` path.

| File | Path |
|---|---|
| Python API reference | `C:\Users\DELL\.claude\skills\adk-cheatsheet\references\python.md` |
| Docs URL index | `C:\Users\DELL\.claude\skills\adk-cheatsheet\references\docs-index.md` |

> ⚠️ **Both offline files are a pre-2.0 mirror.** `docs-index.md` contains `agents/workflow-agents/*` but **no `/graphs/*` entries at all** — the graph engine postdates it, and every URL in it is on the old `google.github.io` host. `python.md` is still good for `Agent` signatures, `generate_content_config`, and `Runner`. It is **not** a source for graph APIs. For anything graph-shaped, go to `adk.dev/graphs/`.

## 3. Data flow in a graph — verified, and it changed our design

All of this is quoted from `adk.dev/graphs/data-handling/index.md` `[L1.13, L1.14, L1.16, L1.21–L1.23]`.

| Question | Answer |
|---|---|
| How does a node pass data on? | `return Event(output=value)` or `yield Event(output=value)`. A bare `return` "passes a `None` value to the next node" |
| How many outputs per node? | **One.** "Nodes are only allowed to emit a single `Event.output` data payload per execution." Two yields carrying `output` = runtime error. Extra yields carrying only `message`/`state` are fine |
| How does a **code node** receive input? | Declare the typed parameter: `def city_report(node_input: CityTime)` |
| How does an **agent node** receive input? | **Differently — no parameter binding.** "the predecessor's `event.Output` is delivered as the agent's user content" `[L1.21]` |
| Session state | Write `Event(state={"k": v})`; read via `ctx.state`. Not for large payloads |
| Instruction templating | Two forms for graph agent nodes: `{Model.field}`, or `<Model.field from producing_node>` to qualify by producer |
| Does a bare `{my_key}` work? | **Not in a graph agent node.** Bare-key interpolation is documented for the *prebuilt* `SequentialAgent`/`ParallelAgent`/`LoopAgent` path, where an `output_key` write is substituted into the prompt. Do not mix the two models `[L1.22]` |

**What this changed.** The plan had `asset_generator_agent`'s instruction reading `{style_rules}` as a bare state key. That form is undocumented for graph nodes, so the rules would likely have silently rendered as literal text — the memory system appearing to work while doing nothing. Fix: a small **code node**, `attach_style_rules`, sits between extraction and generation, reads `ACTIVE` rules live, and returns an `AssetGenInput` model. The instruction then templates the documented way, `{AssetGenInput.style_rules}`.

Side benefits, which is how you know it's the right shape: rules are read at the moment of generation rather than at scan time, no LLM is asked to copy a list verbatim through `ExtractedMetadata`, and `/regenerate-asset` can build `AssetGenInput` directly from the stored metadata plus a fresh rule read — the endpoint and the graph share one contract.

## 4. Gotchas that survived verification

| # | Rule | Consequence |
|---|---|---|
| 1 | **Never fix a model 404 by renaming the model.** Fix `GOOGLE_CLOUD_LOCATION` — try `global`, then `us-central1` `[L2.7]` | Dropping below Gemini 3.5 fails a **pass/fail** submission gate `[L3.6]`. Not a style point |
| 2 | `output_schema` **disables tool calling** `[L1.17]` | Fine for all three of our agents. Never set it on an agent that must call tools |
| 3 | One `Event.output` per node execution `[L1.14]` | `GeneratedAssets` is one model with four fields, never four emissions |
| 4 | Agent nodes get the predecessor payload as **user content**, not a bound parameter `[L1.21]` | Use `input_schema` for coercion; don't expect a function-style signature |
| 5 | Build graphs in a **factory function** | Module-level globals risk "parent already bound" on re-import |
| 6 | Firestore `order_by()` filters for field existence `[L4.7]` | A transaction row without `created_at` is invisible to the Rule Curator query. Always write it |
| 7 | Graph workflows do **not** support live streaming `[L1.20]` | Don't promise streamed progress in the dashboard or the demo video |
| 8 | `adk web` is dev-only | Cloud Run runs our own FastAPI app, not the playground |

Two rules from the old version apply to **tools**, not graph nodes, and must not be carried into node code: `ToolContext` as the last parameter, and state writes via `tool_context.state`. Graph nodes use typed parameters and `Event(state=...)` `[L1.13]`.

## 5. Claims from the 2026-08-14 version that were wrong

| Old claim | Reality |
|---|---|
| "`SequentialAgent`, `ParallelAgent`, `LoopAgent` — ❌ ALL GONE" | **False.** All three still ship. ADK's own word is *"superseded"* `[L1.8, L1.9]`. The page is live at `adk.dev/agents/workflow-agents/` |
| ADK v2.6.3 is latest | 2.7.0 `[L1.1]` |
| Pub/Sub toolset is needed for triggers | **Cut.** The only trigger is a human pasting a URL. Nothing to decouple |
| `dispatch_gmail_approval` as a 7th pipeline node | **Cut.** Replaced by a dashboard button — saves 3–5 days of OAuth2 work |
| "Gmail email-approval is better for demo UX and judges" | Unsupported assertion. A dashboard shows the same approval *and* the four editable assets *and* the rule toggles in one frame |
| Local skill files are the reference for Workflow APIs | They are a **pre-2.0 mirror** with zero graph coverage — see §2 |
| `get_fast_api_app()` for serving | ⬜ Unverified. We need custom endpoints regardless — plain FastAPI + `Runner` |
| Model `gemini-3-flash-preview`, "NEVER change" | Below the mandatory 3.5 floor. Now `gemini-3.7-flash` `[L3.2]` |

## 6. Firestore session service — checked, not applicable

`adk.dev/integrations/firestore-session-service/index.md` documents `FirestoreSessionService` and `FirestoreDatabaseRunner` — a genuinely durable, Firestore-backed session store. It would be the obvious answer to "can a graph pause survive a Cloud Run instance dying?"

**It is ADK Java only** (`com.google.adk.sessions.FirestoreSessionService`, artifact `google-adk-firestore-session-service`) `[L1.24]`. There is no documented Python equivalent. So for a Python build there is no supported path to a durable cross-restart graph pause — which is precisely why Phase 2 is a FastAPI endpoint with Firestore-backed correlation by transaction ID, and why that answer holds up under questioning.

## 7. CLI

| Command | When | Notes |
|---|---|---|
| `adk doctor` | First hour | Diagnoses env vars, auth, location |
| `adk web --port 8000` | Dev loop | Playground. Dev only |
| `adk eval <agent> <evalset.jsonl>` | Day 14 | Needs an evalset file first |
| `adk deploy cloud_run ...` | Day 13 | We likely use a custom Dockerfile instead — verify which on the day |
| `adk create <name>` | Day 1 | ⬜ Scaffolds the *template-agent* layout. Our layout is graph-shaped and hand-rolled — see the repo tree in the architecture doc. Use it to inspect conventions, not as our structure |

_Last updated: 2026-08-16_
