# Research

## What This Workspace Is For
Everything decided before code: the competition rules, why Taskmaster, what problem ProjectSync solves, and the ADK reference material the build reads from. Decisions land here first, then flow into `build/`.
All decisions are now **closed** — see [projectsync_full_spec.md](../../projectsync_full_spec.md) (Aug 15). Factual claims are audited in [VERIFICATION_LEDGER.md](../VERIFICATION_LEDGER.md).

## Process
1. Verify a claim against a primary source before it enters any doc. Record the verdict in the ledger with a source link.
2. Frame the decision, state the alternatives and their real costs, then lock it — and record what was rejected and why. The rejections are as load-bearing as the choices; they are what "engineering judgment" looks like to a judge.
3. Push locked decisions into `build/`. Research files stop being edited once a decision is spec'd.

## Files In Here
- **`hackathon_rules.md`** — timeline, mandatory stack (verbatim), tracks, three-stage judging incl. the pass/fail gate and the +1.0 bonus system, corrected $180K prize table. Re-verified 2026-08-16.
- **⭐ `adk_api_cheatsheet_notes.md`** — copy-paste code blocks: Pydantic contracts, `scan_github_repository`, the three agents, graph assembly, Firestore reads/writes, FastAPI endpoints.
- **`adk_framework_reference_digest.md`** — official ADK URL index and gotchas.
- `track_decision.md` / `track_comparison.md` — why Taskmaster, LOCKED.
- `problem_statements.md` — BYOF framing, user story, workflow diagram, scope boundaries.
- `product_story_and_requirements.md` — end-to-end journey, architecture matrix, memory spec, env checklist.
- `strategic_risk_and_win_analysis.md` — risk register, failure modes, rubric alignment.
- `web_evidence_and_analysis.md` — competitive landscape, demo-script outline.
- `resource_roadmap.md` — setup steps and learning resources.
- `CONTEXT.md` — this file.

## What Good Output Looks Like
- Every number, model ID, API name, and prize figure traces to a primary source, or is explicitly marked unverified. No confident-sounding guesses.
- Rejected options are written down with their cost, not silently dropped.
- A reader can answer "why this and not that?" for every architectural choice without asking.

## Constraints
- **Never state an API or model name from memory.** The three worst errors found in this tree were all fluent, plausible, and wrong: `SequentialAgent` "removed", a fabricated prize table, and a model pinned below the mandatory floor.
- Mark unverified claims ⬜ rather than deleting them — a flagged gap is useful, a silent one is not.
- Research docs describe decisions, not code. Code patterns belong in `adk_api_cheatsheet_notes.md`; architecture belongs in `build/`.
- `.agents/` is a frozen historical log. Never cite it as current architecture.

_Last updated: 2026-08-16_
