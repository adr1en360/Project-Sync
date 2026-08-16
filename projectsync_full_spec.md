# ProjectSync — Full Build Spec
Last updated: Aug 15, 2026 (all open decisions resolved) · Deadline: Aug 31, 2026, 5:00 PM PT · 16 days remaining

> 📌 **This file is the source of truth for product decisions. Three of its API statements were
> later found wrong.** The decisions below stand. Three sentences that describe *how* the ADK
> works do not, because they were written before the ADK 2.0 documentation was checked line by
> line. Each one now carries an inline ⚠️ note where it appears:
>
> | § | The spec says | Corrected to | Ledger |
> |---|---|---|---|
> | 3 | `SequentialAgent` runs three `LlmAgent`s | ADK 2.0 graph `Workflow`, built by a factory function | `[L1.2]` |
> | 4 | "ADK has no built-in agent type for a human decision that may arrive hours or days later" | `RequestInput` **does exist.** The reason Phase 2 stays outside the agent run is different — see the note | `[L1.10, L1.11]` |
> | 5 | rules read into `{style_rules}` | `{AssetGenInput.style_rules}` — a bare state key renders as literal text | `[L1.22]` |
>
> Nothing else in this file changed. Where a *product* decision here conflicts with any
> document under `docs/`, this file wins. Where an *ADK API* claim here conflicts with
> [docs/VERIFICATION_LEDGER.md](docs/VERIFICATION_LEDGER.md), the ledger wins — it cites the
> primary source.

## 1. Overview

**Name:** ProjectSync
**Track:** Taskmaster — All Things Agentic Hackathon (Google/Devpost)
**One line:** Turns a finished GitHub repository into career-ready outputs with one human approval, and gets better at the user's voice over time.

**BYOF (Bring Your Own Friction):** The user builds many hackathon and personal projects. Only a small fraction ever get a portfolio entry, a resume line, or a social post, because doing that manually for every project is tedious enough that it gets skipped. ProjectSync removes the manual step.

**Test/demo repo:** ProjectSync's own repository. The user runs the tool on the codebase that builds it.

## 2. Trigger

- **Only trigger:** User pastes a GitHub URL into a web form → clicks a button → `HTTP POST /api/v1/trigger-sync`. (Pub/Sub release-event path dropped — see Section 6.)

## 3. Phase 1 — Reasoning

**Not an agent — plain code runs first:**
`scan_github_repository()` — uses `httpx` against the GitHub REST API. Reads README, dependency/build manifests, top-10 most-modified files by commit count, most recent 25 commits, and directory structure shape. No LLM call in this step.

**Then an ADK 2.0 `SequentialAgent` runs three `LlmAgent`s, in order:**

> ⚠️ **Corrected 2026-08-16 — build an ADK 2.0 graph `Workflow` instead.** `SequentialAgent` is
> superseded, not removed, so the sentence above still runs. It is the wrong choice anyway: a
> graph makes the three deterministic Python nodes visible as nodes, and Stage Two scores
> architecture on decoupling and state management `[L3.8]`. The three agents and their order are
> unchanged — only the container is. Build it with a factory function; a module-level `Workflow`
> can bind a node twice on a second import. Node-by-node mapping:
> [docs/build/adk_2_0_architecture_migration.md](docs/build/adk_2_0_architecture_migration.md).
>
> `state["..."]` below also reads differently in a graph. A code node binds a typed parameter; an
> **agent node does not** — it receives the predecessor's `Event.output` as user content `[L1.21]`.
> The data still flows in the order shown; the mechanism is the graph edge, not a shared dict.

1. **ExtractionAgent** — reads the scan output. Writes structured metadata to `state["extracted_metadata"]`.
2. **AssetGeneratorAgent** — reads `{extracted_metadata}` and the user's stored style rules (see Section 5). Writes four outputs to `state["generated_assets"]`:
   - Repo documentation sheet (KMS-style markdown)
   - Portfolio card (structured JSON)
   - Resume bullet draft
   - LinkedIn/X post draft
3. **PathEvaluatorAgent** — temperature 0. Scores completeness of the repo and its generated assets. Recommends `FULL_PUBLISH` or `PRIVATE_ONLY`. Writes to `state["path_recommendation"]`.

**On this agent's purpose — clarified:** "complete" here does not mean the code works. It means the repo is safe and ready to show a stranger — a real README, no exposed secrets, no leftover TODOs in core files. A repo can be functionally complete and still fail this check, including the user's own real, working hackathon projects built under time pressure. This is a distinct risk from code quality, and it is the reason this step stays in the build.

**Demo proof plan:** since the user will only test against their own finished repo, the branch to `PRIVATE_ONLY` may never fire in a live test. To prove the gate is real on camera, run the agent once against an early, genuinely incomplete commit of the ProjectSync repo itself (from early in the build, before the README was finished) — free to obtain, since that commit already exists in the user's own history. Contrast this against the final commit at demo time.

**Then plain code again:** persist the full transaction (metadata, assets, recommendation) to Firestore, collection `projectsync_transactions`, status `PENDING_APPROVAL`.

## 4. Phase 2 — Action

Not an ADK agent run. Plain FastAPI code. ADK has no built-in agent type for a human decision that may arrive hours or days later — Phase 2 must sit outside any agent run for this reason.

> ⚠️ **Corrected 2026-08-16 — the decision is right, the reason is wrong. Do not repeat the reason
> to a judge.** ADK 2.0 *does* have a built-in human-in-the-loop node: `RequestInput` `[L1.10]`. A
> judge who knows the framework will know that, and an incorrect claim about the framework costs
> more credibility than the design choice ever earned.
>
> **Say this instead.** Phase 2 stays plain FastAPI because the pause has to survive the process,
> not because no node exists. Cloud Run scales to zero between the trigger and the approval, so a
> paused run's process is gone before the human returns. Whether `RequestInput` can resume across
> a restart is **undocumented** `[L1.11]`, and the durable session backend that would hold it —
> `FirestoreSessionService` — is **ADK Java only, with no Python equivalent** `[L1.24]`. So the
> resume point is Firestore and the resume trigger is an HTTP request. That is a deliberate
> failure-tolerance decision, which is exactly what the architecture criterion scores `[L3.8]`.
> Full write-up: [docs/build/adk_2_0_architecture_migration.md](docs/build/adk_2_0_architecture_migration.md).

Endpoint: `POST /api/v1/approval-callback`

User reviews all four generated outputs on a dashboard. User may edit any draft. User clicks **Approve** or **Discard**.

**On Approve:**
1. Commit the documentation sheet to the user's own repo, `/docs/` folder, via PyGithub (`create_file`/`update_file`). Returns a commit SHA. Real, closed-loop, provable.
2. Commit the portfolio card JSON to a dedicated private repo (`portfolio-data`). Path A — resolved. See Section 8.
3. Run the **Rule Curator step** — proposes new rules, does not activate them. See Section 5.
4. Set the Firestore row status to `COMPLETED`.

## 5. Memory System

Two memory types.

**Episodic memory** — already exists, no new build required. Each Firestore transaction row *is* an episodic record: which repo, what was extracted, what was generated, what the human approved or edited, and when.

**Semantic memory (style rules)** — one Firestore document per user. Holds a list of short rules: `{rule_text, source_transaction_id, created_at}`. Read into `{style_rules}` and injected into the `AssetGeneratorAgent` instruction on every run.

> ⚠️ **Corrected 2026-08-16 — a bare `{style_rules}` does not resolve in a graph agent node**
> `[L1.22]`. It renders in the prompt as the literal seven characters, the model never sees a
> rule, and every visible part of this system still works: rules save, display, and toggle. The
> feature becomes a prop that demos correctly. That form is real, but it belongs to the
> prebuilt-agent `output_key` path, not to a graph.
>
> **The build.** A code node `attach_style_rules` queries the `ACTIVE` rules and returns an
> `AssetGenInput` — `ExtractedMetadata` plus `style_rules: list[str]`. The generator instruction
> then uses `{AssetGenInput.style_rules}`, which is the supported template form. No language
> model is ever asked to copy a list of rules forward.
>
> **The test that catches it** — `tests/test_style_rules_change_output.py`. Toggle a rule,
> regenerate, assert the draft *changed*. A test that only asserts generation succeeded cannot
> tell a working memory system from a demonstration of one.

**Rule states — three values, all user-visible and user-toggleable:**

| State | Meaning |
|---|---|
| `PROPOSED` | Curator suggested this rule. Not yet applied to any generation. |
| `ACTIVE` | Rule is read and applied on every future run. |
| `INACTIVE` | Rule exists but is turned off. Includes dismissed proposals — kept, not deleted, so the user can reactivate later from a "manage rules" list. |

**Two paths write a rule, both event-triggered — no cron, no scheduler, no heartbeat:**

1. **Manual flag** — during Phase 2 review, the user marks one specific edit as "keep this as a rule." Writes a rule directly in `PROPOSED` state, same as path 2 below — the user still confirms it before it goes `ACTIVE`.
2. **Rule Curator sub-agent** — runs after Approve, as the third step in Phase 2. Reads the last N completed episodic records via a plain Firestore query, ordered by date. No vector search, no semantic index. Looks for a pattern across multiple approved projects. Writes a `PROPOSED` rule.

**Rejected this session: inferring a rule from silence.** An earlier idea proposed that the curator note "what format the user must have liked" whenever no edit was made. Silence is weak evidence — it may mean the user liked the output, or it may mean the user didn't review closely. Building inference on top of an unverified signal adds real complexity for no confirmed benefit. **Kept instead, as the one implicit-signal case worth building:** after three consecutive approvals with zero edits to one output type, the curator proposes "lock this as the default" — this converts a repeated pattern into one proposal, not a per-run guess.

**Resolved: every rule requires one click to move from `PROPOSED` to `ACTIVE`.** Reason (user's own): tone may differ across posts, so a rule learned from one project should not silently bind every future one. This keeps one governance pattern across the whole system — every consequential agent decision (publish/private, and rule activation) passes through one human confirmation.

**Rules are read live, never cached.** Every Phase 1 run queries Firestore fresh for the user's current `ACTIVE` rules. Toggling a rule on or off takes effect on the next generation with no redeploy and no service restart.

**Regenerate — new this session.** Each output tab in the dashboard gets a "Regenerate" action. This re-runs `AssetGeneratorAgent` alone, using the already-extracted metadata already sitting in Firestore for that transaction, plus whatever rules are `ACTIVE` right now. It does not re-scan the repository and does not re-run extraction. This lets a rule change take effect on the current, still-pending review — not just on the next repository.

Every write to memory in this design fires from a human action — a URL paste or an Approve/confirm click. Nothing runs on a clock. This matches the Taskmaster one-shot-per-trigger requirement and avoids new scheduling infrastructure with 16 days left.

## 6. GCP Services (2)

| Service | Purpose |
|---|---|
| Cloud Run | Hosts the FastAPI app — both `/trigger-sync` and `/approval-callback` |
| Firestore | Transaction state (episodic memory) + user style rules (semantic memory) |

**Pub/Sub — dropped.** Pub/Sub is a Google Cloud message queue: a publisher sends an event to a "topic," and a subscriber receives it later, independent of whether the receiving service is up at that exact moment. It exists to decouple an event source (like a GitHub Release webhook) from the code that processes it. This build has no need for that decoupling — the only trigger is a manual URL paste, handled directly by the endpoint. The hackathon rule needs at least one GCP service; two are already in use. Adding Pub/Sub here would be one more unfamiliar piece to learn and wire correctly, for zero required benefit.

## 7. Explicitly Cut From This Build

- Gmail OAuth2 approval flow → replaced with a dashboard button
- Continuous/cron-based re-sync on every push → one-shot per trigger only
- Full cross-run semantic search over a KMS vault → replaced with a plain recency-ordered Firestore query
- Resume bullets and LinkedIn/X post → stay as copy-paste drafts, clearly labeled as not auto-published, to the user and to judges

## 8. Stretch Goal — Calendar Reminders (only if time remains)

New idea, gated by the user as "if there's time," not core scope. A scheduler connects to Google Calendar to add events or reminders.

**Honest cost note:** this sits in the same cost class as the Gmail approval flow already cut from this build. Google Calendar write access needs 3-legged OAuth2 tied to the user's personal account — the same setup overhead named earlier as a 3-to-5-day sink. This goes last, after the core loop, the rule system, and the fallback handling below are all working end to end. Do not start this until those are done.

## 9. Failure Fallbacks

No step in this pipeline fails silently. Every step writes its state to Firestore before it fails, so a retry resumes from that point — it does not restart the whole run. This directly answers a named judging criterion: failure recovery and state persistence.

| Step | Failure mode | Fallback |
|---|---|---|
| Repo scan | Rate limit, network error, no access | Retry once with backoff. On second failure, set status `FAILED_SCAN` with the error message. Surface plainly on the dashboard. |
| ExtractionAgent | Malformed or empty output | Retry once with the same input. On second failure, set status `FAILED_EXTRACTION`. |
| AssetGeneratorAgent | Malformed output, schema violation | Retry once. On second failure, set status `FAILED_GENERATION`. |
| PathEvaluatorAgent | Any failure | **Default to `PRIVATE_ONLY`.** Never default to publishing something that was never scored. |
| GitHub commit (on approve) | Auth expired, rate limit, conflict | The two publish actions (repo-doc commit, portfolio-card commit) are tracked as two separate booleans already in the schema. A failure in one does not block or falsely mark the other. Show a "Retry" action scoped to just the failed piece — not a full re-approval. |
| Rule Curator | Any failure | Non-blocking. Log it, skip proposing a rule this round, do not fail or delay the main approval. This step is a bonus layer, not a dependency of the core loop. |

## 10. Decisions — Resolved (Aug 15, 2026)

1. **Portfolio target — Path A.** Commit the portfolio card JSON to a dedicated private repo (`portfolio-data`). No hosting, no webhook, buildable now. Path B (live site, dynamic multi-target connection) stays as a stated future direction, not hackathon scope.
2. **Rule Curator activation — requires one click.** A proposed rule shows on screen and waits for confirmation before it applies to future runs. Reason: tone may differ across posts, so a rule should not auto-bind silently.
3. **Pub/Sub — dropped from the build entirely.** See Section 6.
4. **The real repo — ProjectSync's own repository.** Used for both testing and the demo video.

All four open items from the prior version of this spec are now closed.

## 11. Build Order

1. Core loop — Phase 1 pipeline, Phase 2 actions, Path A portfolio target. Already spec'd, no open questions.
2. Rule system — states, manual flag, curator proposal, Regenerate action.
3. Fallbacks — every row in Section 9. Not optional. This is a scored criterion, not polish.
4. Calendar stretch goal — only after 1 through 3 are working end to end.
