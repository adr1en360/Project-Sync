# Problem Statements — Career OS vs. ProjectSync

> Updated: **2026-08-16** · aligned to [projectsync_full_spec.md](../../projectsync_full_spec.md) (locked Aug 15)
> Career OS = the long-term product. ProjectSync (M2) = what gets built for the hackathon.

---

## 1. Career OS — the full product vision

An AI-native **personal career operating system** that turns everyday project work into structured professional assets. It is the intelligence layer between a creator's repositories and their knowledge base, portfolio, resume, and social channels.

| Module | Purpose | Status |
|--------|---------|--------|
| M1: Build Tracker | Watches active development to generate a raw build log | Future |
| **M2: ProjectSync** | Ingests a finished repo, extracts metadata, generates career assets, publishes on one approval, and learns the user's voice | **← HACKATHON BUILD** |
| M3: Targeted Resume Generator | Reads a job description, scores project relevance, outputs tailored bullets | Future |
| M4: Profile & README Synchronizer | Updates profile READMEs as new projects are catalogued | Future |
| M5: Social Content Engine | Platform-tailored posts in the user's voice | Future |
| M6: Multi-Channel Gateway | Approval requests via email, Telegram, webhooks | Future |

> **M6 is explicitly not in the hackathon build.** The earlier version of this file listed "Gmail only for hackathon." Gmail was cut — see §5. The approval channel is a dashboard.

---

## 2. ProjectSync — the hackathon build

**Track:** Taskmaster — *"Build a Complete Workflow, Not Just a Chatbot."*

**One line:** Turns a finished GitHub repository into career-ready outputs with one human approval, and gets better at the user's voice over time.

Both halves matter. The first half is the workflow. The second half is what separates this from a prompt template — and it is the part the old version of this doc omitted entirely.

### User story

> *"As a developer, when I finish a project, I want an agent to read my repository, draft my documentation, portfolio card, resume bullets, and social post, decide whether the project is presentable, and publish only after I approve — and I want it to stop making the same mistakes I keep correcting."*

### The problem

Finishing a project and *recording* it are two different jobs, and only the first one is fun. Cataloguing a project by hand means re-reading your own code, writing a technical overview, reformatting it for a portfolio, compressing it into resume bullets, and drafting a post. It is repetitive, it is unrewarding, and it happens at the exact moment you want to start the next thing.

So it does not happen. Projects stay scattered, portfolios go stale, and six months later the details are gone.

> ⬜ The prior version claimed this takes **45–60 minutes per project**. That number has no source. It is a plausible self-estimate, not evidence. Use it only if labelled as an estimate — a judge who asks "where's that from?" should get a straight answer.

### BYOF — Bring Your Own Folder

ProjectSync writes into **repositories the user already owns**, using the user's own GitHub token. There is no ProjectSync-hosted database of the user's work, no proprietary format, and no lock-in. Generated documentation is committed as markdown to the user's repo; the portfolio card is committed as JSON to the user's private `portfolio-data` repo.

The user can delete ProjectSync tomorrow and keep every artefact it made.

### Terminology

- **Doc sheet** — the markdown documentation file committed to the user's repository under `docs/synced/`.
- **Portfolio card** — a structured JSON record committed to the user's private `portfolio-data` repo. The portfolio site reads from that repo. ProjectSync does not touch the site.
- **Style rule** — a short instruction learned from the user's edits (for example, *"never use the word 'leveraged'"*), stored with state `PROPOSED`, `ACTIVE`, or `INACTIVE`.
- **Transaction** — one Firestore row recording one run end to end: scan, drafts, decision, edits, commit SHAs.

---

## 3. Workflow

```
[User pastes a GitHub repo URL into the dashboard form]
  │
  │  POST /api/v1/trigger-sync          ← the only trigger. No webhook, no Pub/Sub,
  ▼                                       no release tag, no cron.
┌─────────────────────────────────────────────────┐
│ PHASE 1 — ADK graph Workflow (Cloud Run)        │
│                                                 │
│  1. SCAN            code node, no LLM           │
│     README, dependency manifests, 10 most-      │
│     modified files, last 25 commits, tree shape │
│                                                 │
│  2. EXTRACT         gemini-3.7-flash            │
│     → structured project metadata               │
│                                                 │
│  3. ATTACH RULES    code node, no LLM           │
│     reads ACTIVE style rules live from Firestore│
│                                                 │
│  4. GENERATE        gemini-3.7-flash, temp 0.7  │
│     → doc sheet · portfolio card · resume       │
│       bullets · social post   (one object)      │
│                                                 │
│  5. EVALUATE PATH   gemini-3.7-flash, temp 0.0  │
│     → FULL_PUBLISH | PRIVATE_ONLY               │
│                                                 │
│  6. PERSIST         code node                   │
│     Firestore row, status PENDING_APPROVAL      │
└─────────────────────────────────────────────────┘
  │
  ▼
[Dashboard: 4 tabs, editable. Agent recommendation shown with reasoning.]
  │   The user can edit any asset, flag a phrase as a style rule, or hit
  │   Regenerate — which re-runs step 4 alone against the current rules.
  │
  │  POST /api/v1/approval-callback
  ▼
┌─────────────────────────────────────────────────┐
│ PHASE 2 — FastAPI (Cloud Run)                   │
│                                                 │
│  APPROVE:                                       │
│   • doc sheet  → user's repo /docs/synced/      │  two independent commits,
│   • card JSON  → private portfolio-data repo    │  two independent flags
│   • Rule Curator proposes rules (non-blocking)  │
│   • status → COMPLETED                          │
│                                                 │
│  DISCARD: status → DISCARDED. Nothing is written.│
└─────────────────────────────────────────────────┘
```

**What "PRIVATE_ONLY" means.** The evaluator judges whether the repo is **safe to show a stranger** — real README, no exposed secrets, no leftover TODOs in core files. It does *not* judge whether the code works. A fully working project with a placeholder README fails. On `PRIVATE_ONLY` the doc sheet is still generated and still committed; only the public portfolio card is withheld.

**The learning loop.** No rule is ever applied without a human clicking it live. The Rule Curator only ever writes `PROPOSED`. This is deliberate: a system that silently adjusts its own behaviour is one the user cannot debug.

---

## 4. In scope

- Repo scanner that works on any public or token-authorised repo URL
- ADK 2.0 graph `Workflow`: three LLM agents, three code nodes
- Four generated assets from one model emission
- Agentic path evaluation with a stated reason and red-flag list
- Dashboard approval gate with per-asset editing and per-tab Regenerate
- Two real commits to two repos, tracked as two independent flags
- Style-rule memory: propose → one click → active, read live on every generation
- Failure fallback for every step in the pipeline
- Cloud Run deployment + Firestore

## 5. Out of scope — and why

| Cut | Reason |
|---|---|
| Gmail API approval flow | 3-legged OAuth2, 3–5 days. A dashboard shows the approval, all four editable assets, and the rule toggles in one frame. Strictly more capable, far cheaper |
| Cloud Pub/Sub | The only trigger is a human pasting a URL. There is nothing to decouple. Adding it would be architecture theatre |
| GitHub release/webhook triggers | Same reason. Also removes the demo's dependency on an external event firing on cue |
| Portfolio site rebuild webhook | Out of ProjectSync's boundary. It commits the card; the site's own build watches the repo |
| Vector search / embeddings for memory | A recency-ordered Firestore query over the last N transactions is enough at this scale and needs no index |
| Cron / scheduled rule mining | Every memory write fires from a human action. Nothing runs on a clock |
| M1, M3, M4, M5, M6 | Other modules. Not this build |
| Calendar integration | Stretch goal only, and only if everything else is finished. Same 3–5 day OAuth2 cost class as the cut Gmail flow |

_Last updated: 2026-08-16_
