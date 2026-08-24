# ProjectSync — How the Agent Works

ProjectSync is an autonomous **Taskmaster AI Agent** built with Google Agent Development Kit 2.0 (`google-adk` 2.7.0) and `gemini-3.5-flash`. It turns shipped code from a GitHub repository into career assets (documentation, resume bullets, portfolio card, and social post) and learns the user's voice over time.

---

## 1. The 7-Node Directed Acyclic Graph (DAG)

The Phase 1 pipeline executes deterministically through an ADK 2.0 `Workflow`:

```
   START
     │
     ▼
┌──────────────────────────┐
│ scan_github_repository   │  [CODE NODE - HTTPX / GitHub API]
│ in:  repo_url, commit_sha│  Fetches README, package manifests, top modified files,
│ out: RepoScan            │  commit history, and tree structure without LLM cost.
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ extraction_agent         │  [LLM AGENT - gemini-3.5-flash, temp 0.2]
│ in:  RepoScan            │  Extracts technical metadata: problem solved, tech stack,
│ out: ExtractedMetadata   │  architecture, key features, and test/license signals.
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ attach_style_rules       │  [CODE NODE - Firestore Semantic Memory]
│ in:  ExtractedMetadata   │  Queries live ACTIVE style rules from Firestore and
│ out: AssetGenInput       │  attaches them as typed input payload (no template strings).
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ asset_generator_agent    │  [LLM AGENT - gemini-3.5-flash, temp 0.7]
│ in:  AssetGenInput       │  Generates 4 assets matching Pydantic contract:
│ out: GeneratedAssets     │  1. doc_sheet_md (KMS documentation)
└────────────┬─────────────┘  2. resume_bullets (action-impact bullet points)
             │                3. portfolio_card (title, tagline, tags, bullets)
             ▼                4. social_draft (developer launch announcement)
┌──────────────────────────┐
│ select_evaluator_input   │  [CODE NODE - State Router]
│ in:  GeneratedAssets     │  Routes original repository metadata to the evaluator
│ out: ExtractedMetadata   │  so safety evaluation judges the code, not the draft assets.
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ path_evaluator_agent     │  [LLM AGENT - gemini-3.5-flash, temp 0.0]
│ in:  ExtractedMetadata   │  Evaluates publishability: FULL_PUBLISH vs PRIVATE_ONLY.
│ out: PathRecommendation  │  Guards against exposing unlicenced/unsafe projects.
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ persist_transaction      │  [CODE NODE - Firestore Writer]
│ in:  PathRecommendation  │  Saves full transaction to Firestore with status
│ out: Transaction         │  PENDING_APPROVAL, pausing for human review.
└──────────────────────────┘
```

---

## 2. State & Data Flow Architecture

1. **State Injection**:
   * Initial parameters (`repo_url`, `user_id`, `tx_id`, `commit_sha`) are passed into `Runner.run_async()` via `state_delta`.
2. **Typed Pydantic Contracts**:
   * Agent nodes declare an `output_schema`. Gemini outputs strict JSON matching the schema, and Google ADK validates it at runtime.
3. **No Unsafe String Templates**:
   * Dynamic variables and style rules are attached strictly via typed data models (`AssetGenInput`) rather than prompt template interpolation (`{...}`).

---

## 3. The Memory & Curator Learning Loop

ProjectSync features a dual-layer memory system:

### A. Semantic Memory (Style Rules)
* Stored in Firestore collection `projectsync_style_rules`.
* Rules exist in three states:
  * `PROPOSED`: Discovered by the Curator, awaiting user approval.
  * `ACTIVE`: Enforced on every subsequent generation run.
  * `INACTIVE`: Temporarily disabled by the user.

### B. The Adaptive Curator Agent (`memory/curator.py`)
* Runs asynchronously in the background after the user clicks **"Approve"** on the Review Desk.
* **Diff Learning**: Compares the AI-generated draft against what the human edited across 2 or more projects.
* **Pattern Formulation**: Synthesizes concise rules (e.g. *"Do not use buzzwords"*, *"Name the technical constraint first"*).
* **Zero-Edit Streaks**: If a user approves 3 consecutive projects without editing a format, the Curator proposes a format anchor rule.
* **Human-in-the-Loop**: The Curator **never** enables rules automatically; it sets them as `PROPOSED` so the user retains complete control.

---

## 4. Phase 2: Human-in-the-Loop & Dual-Commit

Upon reaching `PENDING_APPROVAL`, the web UI directs the developer to the **Review Desk**:
* **Live In-Place Editing**: Edit any draft before committing.
* **Regeneration**: Single-click regeneration of individual assets with custom guidance.
* **Dual-Commit Execution**:
  1. Commit 1: Pushes `docs/synced/README.md` directly to the inspected repository via GitHub API.
  2. Commit 2: Commits the structured `portfolio_card.json` to the user's private `portfolio-data` repository.
  3. Seeds the **Resume Bullet Bank** with the approved bullet points.
