# Original User Request

> ⚠️ **HISTORICAL RECORD — do not treat as current.** This is the request as filed on 2026-08-11.
> It is kept because it shows where the project started. Several of its premises were later
> corrected or cut. **Current source of truth: [projectsync_full_spec.md](../projectsync_full_spec.md)** (locked Aug 15).
>
> What changed since this was written — see the diff table at the bottom.

## Initial Request — 2026-08-11T11:57:45Z

Comprehensive multi-agent analysis and build blueprint for ProjectSync—an autonomous Taskmaster AI Agent for the All Things Agentic Hackathon (Deadline: Aug 31, 2026; 20 days remaining). The agent ingests finished GitHub repos, extracts technical metadata using Gemini 3.5+, generates multi-format career assets (KMS sheet, portfolio copy, resume bullets, LinkedIn draft), presents an agentic path recommendation, requests human email approval, and syncs to GitHub/Firestore upon confirmation.

Working directory: c:\Users\DELL\Documents\New folder\agentic-hackathon
Integrity mode: development

## Requirements

### R1. Strategic Risk & Win Analysis
Identify concrete failure modes and competitive win strategies tailored strictly to the 3-week timeline and 40-30-30 judging rubric (Utility, Architecture, Demo).

### R2. Optimal Stack & Timeline Engineering
Calculate exact build velocity from current date (Aug 11, 2026) to submission cutoff (Aug 31, 2026, 20 days left; credit request cutoff Aug 28), mapping ADK, Cloud Run, Firestore, Pub/Sub, and Gemini 3.5+.

### R3. Demo Storyboard & Mistake Prevention
Design a minute-by-minute 4-minute live demo script proving GCP deployment on camera, and list critical execution mistakes to avoid.

### R4. Resource Roadmap
Curate exact Devpost Resources tab items, ADK documentation, and GEAR webinars to watch for immediate mastery.

## Acceptance Criteria

### Execution & Scoring Bar
- [ ] 20-day timeline mapped into 3 clear build phases (Week 1: Core ADK Agent, Week 2: GCP Infra & Integration, Week 3: Demo & Submission).
- [ ] Detailed 4-minute demo video script with exact GCP console proof timestamps (Cloud Run, Vertex AI logs, Firestore).
- [ ] List of 5 critical mistakes and 4 essential Devpost resources mapped directly to the Taskmaster track.

---

## What changed since 2026-08-11

| In the original request | Current, per spec |
|---|---|
| Working dir `Documents\New folder\agentic-hackathon` | `Documents\Project Sync`. Links using the old path were broken and have been fixed |
| 20 days remaining | **15 days** (Aug 16 → Aug 31, 5:00 PM PT) |
| "Gemini 3.5+" — later implemented as `gemini-3-flash-preview` | **`gemini-3.7-flash`.** Gemini 3 Flash is *below* the mandatory 3.5 floor and would have failed the pass/fail Stage One check `[L2.3, L3.6]` |
| Pub/Sub in the stack | **Cut.** The only trigger is a human pasting a URL into a form. Nothing to decouple |
| "Requests human email approval" via Gmail API | **Cut.** Replaced by a dashboard. 3-legged OAuth2 cost 3–5 days and a dashboard does strictly more — approval, four editable assets, and rule toggles in one frame |
| Approval by replying `YES` to an email | `POST /api/v1/approval-callback` from the dashboard |
| Rubric read as "40-30-30" only | Correct, **but incomplete**: there is also a **pass/fail Stage One** completeness gate before any scoring, and **Stage Three bonuses worth up to +1.0** `[L3.6, L3.7]`. Both were missing from every doc |
| No memory or learning | **Added.** Style-rule memory with `PROPOSED`/`ACTIVE`/`INACTIVE` states. This is the second half of the product's one-line pitch |
| ADK 1.x-style agent chaining | ADK **2.0 graph `Workflow`** with `edges` |

Everything factual in the current docs is audited in [VERIFICATION_LEDGER.md](VERIFICATION_LEDGER.md).

_Annotated: 2026-08-16_
