# Build

## What This Workspace Is For
Architecture, data contracts, day-by-day plan, and deployment for ProjectSync. **Planning material only** — source code lives at the repository root under `projectsync_agent/`, not in here.
Active as of 2026-08-16: track locked (Taskmaster), spec locked ([projectsync_full_spec.md](../../projectsync_full_spec.md), Aug 15), all API claims verified ([VERIFICATION_LEDGER.md](../VERIFICATION_LEDGER.md)).

## Process — 15 days (Aug 16 → Aug 31, 5:00 PM PT)

Build order is fixed by spec §11. Do not start a later stage before the earlier one runs end to end.

1. **Core loop (Aug 16–22).** Scaffold → schemas → `scan_github_repository` code node → 3 LLM agents → `persist_transaction` code node → graph assembled and running locally via `Runner`. Then Phase 2: dashboard, `/approval-callback`, PyGithub commits to both targets.
2. **Rule system (Aug 23–25).** Rule states (`PROPOSED`/`ACTIVE`/`INACTIVE`), live rule read, manual flag during review, Rule Curator sub-agent, per-tab Regenerate.
3. **Fallbacks (Aug 26–27).** Every row of the failure matrix. **Scored, not polish** — judging explicitly rewards "design failure-tolerant agents."
4. **Deploy, eval, demo, submit (Aug 28–31).** Cloud Run, `adk eval`, record the 4-min video, Devpost writeup. Plus the two free bonuses: build write-up (+0.2) and `#AllThingsAgenticHackathon` post (+0.2).
5. **Calendar stretch goal — only if 1–4 are all working.** 3-legged OAuth2, same 3–5 day cost class as the already-cut Gmail flow. Do not start it early.

## Files In Here
- **⭐ `adk_2_0_architecture_migration.md`** — #1 file to read before coding. Verified ADK 2.0 graph API, the Phase 1 node graph, hard constraints that will bite, repo layout, failure matrix, troubleshooting. Every claim carries a ledger ID.
- `stack_and_timeline_engineering.md` — day-by-day deliverables, data contracts, verification commands.
- `PROJECTSYNC_MASTER_BUILD_BLUEPRINT.md` — system logic, risks, module boundaries, memory system. **Code snippets in it predate the verified API — do not copy-paste them.** Use `research/adk_api_cheatsheet_notes.md`.
- `CONTEXT.md` — this file.

## What Good Output Looks Like
- Phase 1 graph runs end to end locally with zero errors; final state carries `ExtractedMetadata`, `GeneratedAssets` (all four fields populated), `PathRecommendation`, and a Firestore row at `PENDING_APPROVAL`.
- PathEvaluator provably discriminates: an early, genuinely incomplete commit of this repo returns `PRIVATE_ONLY`; the final commit returns `FULL_PUBLISH`.
- Approve produces **two real commit SHAs** — doc sheet into the target repo, portfolio card JSON into the private `portfolio-data` repo — tracked as two independent booleans, so one failing never marks the other done.
- Toggling a style rule and hitting **Regenerate** visibly changes the draft with no redeploy and no re-scan.
- Firestore lifecycle visible in the GCP Console: `PENDING_APPROVAL` → `COMPLETED`.
- README gets a judge from clone to a working request in under 10 minutes.

## Constraints
- **Model: `gemini-3.7-flash`.** Never below Gemini 3.5 — that is a **pass/fail** submission gate, not a preference. `gemini-3-flash-preview` fails it; `gemini-3-pro-preview` is shut down. A 404 means fix `GOOGLE_CLOUD_LOCATION`, never the model name.
- **Exactly 2 GCP services: Cloud Run + Firestore.** Pub/Sub is dropped — the only trigger is a manual URL paste, so there is nothing to decouple. Gmail API is dropped — replaced by a dashboard button.
- **Framework: ADK 2.0 graph `Workflow`.** Code nodes are plain callables in the `edges` tuple; LLM nodes are `Agent` instances with Pydantic `input_schema`/`output_schema`.
- **All code comments and docstrings in ASD-STE100 Simplified Technical English.** Approved vocabulary, active voice, imperative for instructions, one instruction per sentence, no `-ing` verb forms, ≤20 words per procedural sentence. Markdown prose stays normal English. See `research/adk_api_cheatsheet_notes.md` for the worked examples.
- **One `Event.output` payload per node execution.** `GeneratedAssets` is one model with four fields, never four emissions.
- **A graph agent node takes no instruction template.** Its input model arrives as JSON user content. A bare `{key}` resolves from session state; a dotted `{Model.field}` resolves never — the dot fails the state-name check and the braces reach the model as text, with no error. This is why the `attach_style_rules` code node exists: it puts the rules **on the model**.
- **Agent nodes do not bind parameters.** A code node receives the predecessor payload as its declared parameter; an agent node receives it as user content, coerced by `input_schema`.

- `output_schema` disables tool calling on that agent — fine, none of the three agents need tools.
- Always write `created_at` on transaction rows: Firestore `order_by` silently excludes documents missing the sort field, which would break the Rule Curator query.
- Build the graph in a factory function, never a module-level global.
- Phase 2 is plain FastAPI, outside the graph. `RequestInput` exists and was rejected on undocumented cross-restart durability — state the real reason, never "ADK can't do it."
- Nothing runs on a clock. Every memory write fires from a human action. No cron, no scheduler.
- Python 3.12, `uv`-managed. Run Python via `uv run`.
- Cost estimate ~$50 against the GCP credit (unverified estimate, not a quote).

_Last updated: 2026-08-16_
