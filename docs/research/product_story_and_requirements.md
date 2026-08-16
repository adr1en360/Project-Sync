# Product Story & Technical Requirements

> Updated: **2026-08-16** · aligned to [projectsync_full_spec.md](../../projectsync_full_spec.md) (locked Aug 15)
> Env var names and API surface: [adk_api_cheatsheet_notes.md](adk_api_cheatsheet_notes.md) · Claims: [VERIFICATION_LEDGER.md](../VERIFICATION_LEDGER.md)

---

## 1. Who this is for

Any engineer, AI developer, designer, or technical creator who ships projects to GitHub and needs them to show up in their documentation, portfolio, resume, and social presence — without doing the cataloguing by hand each time.

## 2. The end-to-end journey

### Step 1 — Submit

The user pastes a GitHub repository URL into a form on the dashboard. `POST /api/v1/trigger-sync` returns `202` immediately with a transaction ID; the graph runs in the background.

**This is the only trigger.** No Pub/Sub, no GitHub webhook, no release tag, no schedule. The user finishing a project is a human decision, and the trigger is a human action.

### Step 2 — Scan (code node, no LLM)

`httpx` against the GitHub REST API reads:

- `README.md`
- dependency manifests — `requirements.txt`, `pyproject.toml`, `package.json`, `go.mod`, `Cargo.toml`
- the **ten most-modified files by commit count** — the churn signal for where the real work is
- the **last 25 commit messages**
- the file tree shape, minus binaries and lock files

No language model touches this step. It is deterministic, cheap, and testable.

### Step 3 — Extract (`gemini-3.7-flash`)

Structured metadata: project name, one-liner, problem solved, tech stack, key features, architecture notes, completeness signals. Grounded strictly in the scan — a field with no supporting evidence is left empty rather than invented.

### Step 4 — Attach rules (code node, no LLM)

Reads `ACTIVE` style rules from Firestore **at generation time**. A code node, not an agent — a language model asked to copy a list of rules will eventually drop one.

### Step 5 — Generate (`gemini-3.7-flash`, temp 0.7)

Four assets, returned as **one object**:

| Asset | Destination |
|---|---|
| Doc sheet (markdown) | The user's own repo, `docs/synced/` |
| Portfolio card (JSON) | The user's private `portfolio-data` repo |
| Resume bullets | Dashboard only — the user copies them |
| Social post draft | Dashboard only — **never auto-published** |

### Step 6 — Evaluate path (`gemini-3.7-flash`, temperature 0.0)

`FULL_PUBLISH` or `PRIVATE_ONLY`, with a score, stated reasoning, and a red-flag list.

The question is **"is this safe to show a stranger?"** — real README, no exposed secrets, no leftover TODOs in core files, no placeholder text. It is *not* "does the code work." A working project with a placeholder README fails, and that is correct behaviour. Temperature 0 because the same repo must produce the same verdict twice.

On any failure, the default is `PRIVATE_ONLY`. Nothing that was never scored gets published.

### Step 7 — Persist (code node)

One Firestore row in `projectsync_transactions`: `status=PENDING_APPROVAL`, `created_at=SERVER_TIMESTAMP`, the metadata, the four assets, the recommendation.

### Step 8 — Review

A dashboard with four tabs, all editable, the recommendation and its reasoning displayed. From here the user can:

- edit any asset inline
- flag a phrase as a style rule
- hit **Regenerate** on one tab — re-runs the generator alone against stored metadata + current `ACTIVE` rules, with no re-scan and no re-extraction
- **Approve** or **Discard**

### Step 9 — Publish

On Approve, `POST /api/v1/approval-callback`:

1. Doc sheet → the user's repo. Returns a commit SHA.
2. Portfolio card JSON → the private `portfolio-data` repo. Returns a commit SHA.
3. Rule Curator proposes style rules. **Non-blocking** — if it fails, the approval still completes.
4. Status → `COMPLETED`.

The two commits are tracked as **two independent booleans**. If one fails, the other is still recorded as done, and the retry is scoped to the failed piece — not a re-approval.

On Discard: status → `DISCARDED`, nothing is written anywhere.

> **The two commit SHAs are the proof.** Not a screenshot, not a log line — two real commits in two real repositories that a judge can click.

## 3. Memory

Two kinds, deliberately separated.

**Episodic** — the transaction rows. What was scanned, what was drafted, what the user changed, what shipped. Append-only history.

**Semantic** — style rules. Short instructions in `users/{user_id}/style_rules`, each with state `PROPOSED`, `ACTIVE`, or `INACTIVE`.

Rules of the system, all four load-bearing:

1. **Rules are read live, never cached.** Toggling a rule changes the next generation with no redeploy.
2. **Every rule requires one human click** to go `PROPOSED` → `ACTIVE`. The Curator never writes `ACTIVE`.
3. **Nothing runs on a clock.** Every memory write is triggered by a human action. No cron, no scheduler.
4. **A rule is never inferred from silence.** If the user made no edits, that may mean they approved of the output — or that they did not read it. Building on an unverified signal is worse than not building.

The one deliberate exception to (4): if the same asset type is approved with **zero edits three times consecutively**, the Curator may propose *"lock this format as the default."* Three consecutive is a pattern; one is not.

## 4. Infrastructure — exactly two GCP services

| Service | Role | Auth |
|---|---|---|
| **Vertex AI** (`gemini-3.7-flash`) | Extraction, generation, path evaluation, rule curation | Service account, `roles/aiplatform.user`. Set `GOOGLE_GENAI_USE_VERTEXAI=True` |
| **Cloud Run** | Hosts the FastAPI app and the graph | Service account, Cloud Run Admin to deploy |
| **Firestore** | Transactions + style rules | Service account, `roles/datastore.user` |

Vertex AI is the model provider, so the **infrastructure** service count is two: Cloud Run + Firestore. The rules require at least one `[L3.2]`.

**Removed from the earlier version:**

| Was listed | Status |
|---|---|
| Cloud Pub/Sub (`roles/pubsub.editor`) | **Cut.** Nothing to decouple — the trigger is a human pasting a URL |
| Gmail API (`https://mail.google.com/`, `GMAIL_REFRESH_TOKEN`) | **Cut.** 3-legged OAuth2, 3–5 days, and a dashboard does strictly more |
| Portfolio rebuild webhook | **Cut.** Outside our boundary. The site's own build watches the `portfolio-data` repo |

### External systems

| Service | Role | Access |
|---|---|---|
| GitHub REST API | Read the target repo (`httpx`) | PAT, `repo` scope |
| GitHub Contents API | Write the doc sheet and the card (PyGithub) | Same PAT |

One token, two directions. The user's own token writes to the user's own repos — that is the BYOF guarantee, not a limitation.

## 5. Setup checklist

- [ ] GCP project with billing enabled
- [ ] APIs enabled: **Vertex AI, Cloud Run, Firestore**. That is the whole list
- [ ] Firestore database created (Native mode)
- [ ] GitHub PAT with `repo` scope
- [ ] Private `portfolio-data` repo created
- [ ] `uv` installed, Python 3.12
- [ ] `.env` filled from `.env.example`
- [ ] `adk doctor` passes

Cloud Run environment variables — the current set:

```bash
GOOGLE_GENAI_USE_VERTEXAI=True
GOOGLE_CLOUD_PROJECT=...
GOOGLE_CLOUD_LOCATION=global
MODEL_ID=gemini-3.7-flash
GITHUB_TOKEN=...
PORTFOLIO_DATA_REPO=<user>/portfolio-data
SYNCED_DOCS_PATH=docs/synced
FIRESTORE_TRANSACTIONS=projectsync_transactions
DASHBOARD_BASE_URL=https://...run.app
```

> ⬜ The earlier version listed a **$150** GCP credit. Only a **$24,500** event-wide credit pool is confirmed `[L3.14]`. Re-check the per-participant figure and its deadline on the rules page before planning around it.
> ⬜ The ~$50 total cost figure is an internal estimate, not a quote `[L4.10]`.

_Last updated: 2026-08-16_
