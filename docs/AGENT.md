# ProjectSync — All Things Agentic Hackathon (Google/Devpost)

## Identity
Solo builder (adrienoke), full-stack AI developer, Nigeria. Track: **Taskmaster** (locked).
**One line:** turns a finished GitHub repository into career-ready outputs with one human approval, and gets better at the user's voice over time.
Stack: `gemini-3.7-flash` | ADK 2.0 graph `Workflow` (`google-adk` 2.7.0) | Cloud Run + Firestore | Python 3.11
Deadline: **Aug 31, 2026, 5:00 PM PT** — 15 days left as of 2026-08-16. Judging Sept 1 – Oct 1; winners ~Oct 8.
Spec of record: [projectsync_full_spec.md](../projectsync_full_spec.md) (Aug 15, all decisions closed).

## Folder Map

| Workspace | Purpose |
|-----------|---------|
| research/ | Hackathon rules, track decision, problem statement, ADK reference digest + code cheatsheet |
| build/    | Architecture, day-by-day plan, data contracts, deployment. Source code lives at repo root, not here |
| demo/     | 4-min video script, architecture diagram, Devpost submission copy |

## Routing Table

| Task | Go To | Read First | Tools/Skills |
|------|-------|-----------|--------------|
| Is this claim actually true? | — | ⭐ [VERIFICATION_LEDGER.md](VERIFICATION_LEDGER.md) — every load-bearing claim, checked, with verdicts | — |
| Rules, eligibility, prizes, judging weights | research/ | [hackathon_rules.md](research/hackathon_rules.md), [CONTEXT.md](research/CONTEXT.md) | — |
| Why Taskmaster, problem framing, product story | research/ | [track_decision.md](research/track_decision.md), [problem_statements.md](research/problem_statements.md), [product_story_and_requirements.md](research/product_story_and_requirements.md) | — |
| ADK official URLs + API reference | research/ | [adk_framework_reference_digest.md](research/adk_framework_reference_digest.md) | `adk.dev/llms.txt` |
| Copy-paste ADK code patterns | research/ | ⭐ [adk_api_cheatsheet_notes.md](research/adk_api_cheatsheet_notes.md) — graph `Workflow`, node fns, Pydantic contracts, FastAPI wiring | — |
| Architecture, node graph, build order | build/ | ⭐ [adk_2_0_architecture_migration.md](build/adk_2_0_architecture_migration.md) — graph diagram, node table, troubleshooting | — |
| System logic, memory, failure fallbacks | build/ | [PROJECTSYNC_MASTER_BUILD_BLUEPRINT.md](build/PROJECTSYNC_MASTER_BUILD_BLUEPRINT.md), [CONTEXT.md](build/CONTEXT.md) | — |
| Day plan, data contracts, verify commands | build/ | [stack_and_timeline_engineering.md](build/stack_and_timeline_engineering.md) | — |
| Scaffolding the agent project | build/ | [CONTEXT.md](build/CONTEXT.md), blueprint §5 + §7 | — |
| Demo video, storyboard, submission | demo/ | [CONTEXT.md](demo/CONTEXT.md), [demo_storyboard_and_mistakes.md](demo/demo_storyboard_and_mistakes.md) | — |
| Risk register, rubric alignment | research/ | [strategic_risk_and_win_analysis.md](research/strategic_risk_and_win_analysis.md) | — |
| What to read and when | research/ | [resource_roadmap.md](research/resource_roadmap.md) | — |

## Naming Conventions
- Research notes & digests: `<topic>_digest.md` / `<topic>_notes.md`
- Decision docs: `<topic>_decision.md`
- Guides & migrations: `<topic>_guide.md` / `<topic>_migration.md`
- Specs: `<feature>_spec.md`
- Dated logs: `<YYYY-MM-DD>-<slug>.md`

## Hard Rules
- Model is `gemini-3.7-flash`. Never below Gemini 3.5 — that is a **pass/fail** submission gate. A 404 means fix `GOOGLE_CLOUD_LOCATION`, not the model name.
- Exactly 2 GCP services: Cloud Run + Firestore. No Pub/Sub, no Gmail API.
- Style rules reach the model as `{AssetGenInput.style_rules}`. A bare `{style_rules}` **does not resolve** in a graph agent node `[L1.22]`.
- **Do not use the offline `/adk-cheatsheet` skill for graph APIs.** It is a pre-2.0 mirror with zero `/graphs/*` entries `[L1.26]` and will teach you ADK 1.x. Use `adk.dev` or the local cheatsheet doc instead.
- Every `google.github.io/adk-docs/*` URL is dead — 301 to `adk.dev` `[L1.27]`.
- All code comments and docstrings use **ASD-STE100 Simplified Technical English**.
- `.agents/` is a frozen historical log. Do not cite it as current architecture.

_Last updated: 2026-08-16_
