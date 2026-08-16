# Strategic Risk & Win Analysis

> **Event**: All Things Agentic Hackathon (Devpost / Google Cloud)
> **Track**: The Taskmaster — **LOCKED** ([track_decision.md](track_decision.md))
> **Window**: Aug 16 → **Aug 31, 2026, 5:00 PM PT** — **15 days**
> **Source of truth**: [projectsync_full_spec.md](../../projectsync_full_spec.md) (locked Aug 15)
> **Claim audit**: [VERIFICATION_LEDGER.md](../VERIFICATION_LEDGER.md)
> Rewritten 2026-08-16. Supersedes the 2026-08-11 version, which analysed risk for an
> architecture that no longer exists (Pub/Sub, Gmail API, ADK 1.x `AgentRunner`).

---

## 1. What is being defended

ProjectSync turns a finished GitHub repository into four career assets — a KMS markdown
sheet, a portfolio card, resume bullets, and a social draft — decides whether the work is
good enough to publish publicly, waits for one human approval, then commits to two
repositories. It also learns the user's style rules over time, so the next draft starts
closer to what the user would have written.

**The stack, exactly:** `gemini-3.7-flash` · ADK 2.0 graph `Workflow` · Cloud Run · Firestore.
Two GCP services, one over the minimum of two `[L3.2]`. No Pub/Sub. No Gmail API.

**The graph, exactly six nodes:**

```
START → scan_github_repository → extraction_agent → attach_style_rules
      → asset_generator_agent → path_evaluator_agent → persist_transaction
```

Three of those six are deterministic Python code nodes. That ratio is the argument against
"thin wrapper" and it is load-bearing for the 30% architecture criterion.

### The judging structure — three stages, not one rubric

The earlier version of this document analysed risk against a single "40-30-30 rubric." That
is one of three stages, and the two it omitted are where submissions actually die.

| Stage | Mechanic | Risk it creates |
|---|---|---|
| **One** | **Pass/fail completeness check. No score assigned until it passes** `[L3.6]` | A single mandatory-stack violation is elimination, not a deduction |
| **Two** | Scored **1–5 per criterion**, weighted 40 / 30 / 30 | Ordinary scoring risk |
| **Three** | Bonuses, max final score **6** `[L3.7]` | Up to **+1.0** left on the table by default |

Stage One changes the shape of the risk register: FM-01 below is *elimination-class*, and no
amount of Stage Two excellence compensates for it.

---

## 2. Failure modes

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              FAILURE MODE REGISTER                                   │
├────────┬─────────────────────────────┬───────────────┬───────────────────────────────┤
│ ID     │ Threat                      │ Severity      │ Rubric exposure               │
├────────┼─────────────────────────────┼───────────────┼───────────────────────────────┤
│ FM-01  │ Mandatory-stack violation   │ ELIMINATION   │ Stage One (pass/fail)         │
│ FM-02  │ Memory theatre              │ HIGH          │ Innovation 40% + credibility  │
│ FM-03  │ Graph data-flow contract    │ HIGH          │ Architecture 30%              │
│ FM-04  │ Scope creep into Career OS  │ HIGH          │ Everything (time is the cost) │
│ FM-05  │ Chatbot trap                │ MEDIUM        │ Innovation 40%                │
│ FM-06  │ GCP provisioning delay      │ MEDIUM        │ Demo 30% (no proof shots)     │
│ FM-07  │ Rate limits / token spikes  │ MEDIUM        │ Architecture 30% (resilience) │
│ FM-08  │ Missing GCP proof on camera │ MEDIUM        │ Demo 30%                      │
│ FM-09  │ Stage Three left unclaimed  │ LOW-CERTAIN   │ Up to −1.0 of a max 6         │
└────────┴─────────────────────────────┴───────────────┴───────────────────────────────┘
```

### FM-01 — Mandatory-stack violation (ELIMINATION)

**What it is.** Shipping with a model below the mandated floor, or with a framework or
infrastructure count that does not satisfy the requirements.

**How close this came to happening.** Every document in this tree specified
`gemini-3-flash-preview` or "Gemini 3.5+" loosely. **Gemini 3 Flash is below the 3.5
floor** `[L2.3]`. Because Stage One is pass/fail, that pin was not a style note — it was a
disqualification sitting in the build plan for five days.

**Mitigation.**
- Model pinned to **`gemini-3.7-flash`** in one place — `config.py` — and referenced
  nowhere else by literal string.
- A startup assertion that fails loudly rather than silently falling back:

  ```python
  # Refuse to start if the model pin is below the mandated floor.
  # A silent fallback is worse than a crash. It causes elimination in Stage One.
  MODEL = os.environ.get("MODEL_ID", "gemini-3.7-flash")
  assert MODEL.startswith("gemini-3.7") or MODEL.startswith("gemini-4"), (
      f"Model {MODEL} is below the mandated 3.5 floor. See ledger L2.3."
  )
  ```
- Stack count checked against the rules page, not against memory: ADK satisfies the
  framework requirement, Cloud Run + Firestore satisfies the two-service minimum `[L3.2]`.
- **Verification gate:** re-read the rules page on Aug 29, after the code is frozen. Not
  before — the point is to check the shipped artefact, not the plan.

### FM-02 — Memory theatre

**What it is.** The learning loop appears to work in the demo while doing nothing. The style
rules are read, stored, displayed, toggled — and never actually reach the model.

**This was a real bug in this project's own plan.** The asset generator's instruction read
`{style_rules}` as a bare state key. In an ADK graph agent node that form **does not
resolve** — bare-key interpolation belongs to the prebuilt-agent `output_key` path, not to
graph nodes `[L1.22]`. Left in, the rules would have rendered as literal text. The demo
would have looked fine. The single most differentiating feature would have been a prop.

**Mitigation.**
- A deterministic code node, `attach_style_rules`, reads the active rules and returns a
  typed model. No language model is asked to copy a list.
- The instruction uses the verified template form `{AssetGenInput.style_rules}` — model
  and field, not a bare key `[L1.22]`.
- **The test that catches this class of bug:** generate with a rule `INACTIVE`, toggle it
  `ACTIVE`, regenerate, and assert the two outputs **differ**. A test that only asserts
  "generation succeeded" cannot tell theatre from function.

### FM-03 — Graph data-flow contract violations

**What it is.** ADK 2.0's graph engine has narrow rules about how data moves between nodes.
Breaking them produces runtime failures or silent data loss, both of which surface during
the demo rather than during development.

The three that will bite:

| Contract | The mistake | Consequence |
|---|---|---|
| **One `Event.output` per node execution** `[L1.23]` | Yielding output twice from one node | Runtime error mid-graph |
| **Agent nodes do not bind a typed parameter** — they receive the predecessor's `Event.output` as *user content* `[L1.21]` | Writing an agent node as though it takes a function argument | Input silently absent |
| **Code nodes do bind a typed parameter** | Mixing the two mental models | Type errors, or worse, `None` |

**Mitigation.** The verified contract for every node is written out in
[adk_api_cheatsheet_notes.md](adk_api_cheatsheet_notes.md) as copy-paste code, with the
ledger reference on each non-obvious line. Build from that file, not from memory of ADK 1.x.
Graph construction lives in a factory function, never a module-level variable — on a second
import a module variable can bind a node twice.

### FM-04 — Scope creep into the full Career OS

**What it is.** Building M1 (IDE build tracker), M3 (resume job matcher), M4 (profile README
sync), M5 (social auto-posting), or M6 (chat bots) inside the 15-day window. ProjectSync is
**M2 only**.

**Cost if it happens.** There are 15 days, not 20. The earlier plan's 10–14 day creep
estimate exceeds the entire remaining window.

**Mitigation.**
- Out-of-scope list is written down with a reason per item, in
  [problem_statements.md](problem_statements.md). A written reason is harder to relitigate
  at 2 a.m. than an unwritten one.
- **M5 in particular is cut deliberately, not for time.** The social asset is a draft the
  user copies. Auto-posting inverts the product's promise, which is that a human approves
  before anything is public.

### FM-05 — The chatbot trap

**What it is.** Building a conversational surface, in a track whose brief is literally
*"Build a Complete Workflow, Not Just a Chatbot."* The criteria favour *"high-value,
autonomous execution over simple chat queries."*

**Mitigation.** The only input surface is a form field that takes a repository URL. The only
interaction is one approval click plus optional edits. The UI is a status view and four
editable drafts — no message thread, no send button, no assistant turn.

Also: three of the six graph nodes are Python. Deterministic work is the strongest available
evidence that this is a workflow and not a wrapper.

### FM-06 — GCP provisioning delay

**What it is.** Reaching the final week without a deployed Cloud Run revision, so the demo
has no console proof to show.

**A correction to the earlier plan.** It scheduled a "$150 GCP credit request" for Day 1 and
built the timeline around a 72-business-hour approval. **Neither figure has a confirmed
source** `[L3.14]`. What is verified is a **$24,500 credit pool across the whole event**.
Planning around an unverified per-participant amount is how a timeline acquires a
dependency that does not exist.

**Mitigation.**
- Request credits early regardless — the cost of asking is zero and the figure being
  unverified cuts both ways.
- **Do not make the build depend on approval.** Local development runs against a Gemini API
  key and the Firestore emulator:

  ```bash
  GOOGLE_GENAI_USE_VERTEXAI=False          # Switch to true after GCP access is confirmed.
  GOOGLE_API_KEY=...           # Direct API key. Used for local development.
  FIRESTORE_EMULATOR_HOST=localhost:8080
  GITHUB_TOKEN=...
  ```
- Pre-write the deploy command so first deployment is minutes, not a discovery exercise:

  ```bash
  gcloud run deploy projectsync --source . --region us-central1
  ```
- **Deploy something trivial to Cloud Run in week one**, before the agent works. The purpose
  is to find the IAM and billing problems while they are cheap.

### FM-07 — GitHub rate limits and token spikes

**What it is.** Scanning a repository with `node_modules`, binaries, or deep build output.
Unauthenticated GitHub allows 60 requests/hour. A 403 on camera is an avoidable disaster.

**Mitigation.**

```python
# Directories and file types that add tokens and no signal.
IGNORE_DIRS = {".git", "node_modules", "vendor", "dist", "build", "__pycache__", ".venv", "target"}
IGNORE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".pdf", ".zip", ".tar", ".gz", ".mp4", ".pyc", ".ico"}
MAX_FILE_SIZE_BYTES = 100 * 1024   # 100 KB for each code file.


def is_relevant_file(file_path: str, file_size: int) -> bool:
    """Tell if a file must go into the model context.

    Filter before the request, not after. A large repository can use all of the
    context window with dependency code.
    """
    parts = file_path.split("/")
    if any(part in IGNORE_DIRS for part in parts):
        return False
    if any(file_path.endswith(ext) for ext in IGNORE_EXTENSIONS):
        return False
    return file_size <= MAX_FILE_SIZE_BYTES
```

Plus: authenticate every call with `GITHUB_TOKEN` (5,000 requests/hour), enforce a total
payload budget across the selected files, and use Pydantic `output_schema` on the extraction
and evaluation agents so a malformed response is a validation error rather than a parse
failure three nodes later.

> ⚠️ **`output_schema` disables tool calling** on that agent. Any node that needs both must
> be split into two nodes. This has already been designed for — the scanner is a code node
> precisely so the extraction agent never needs a tool.

### FM-08 — No verifiable GCP proof in the video

**What it is.** A polished UI recording that never shows the cloud. The Demo criterion asks
for *"undeniable proof of execution in the video pitch"* `[L3.5]`.

**Mitigation.** Scene 5 of the demo is proof, on camera, in this order: the two commit SHAs
clicked through in two different GitHub repositories; the Firestore document moving
`PENDING_APPROVAL` → `COMPLETED`; the Cloud Run revision serving live traffic in Cloud
Logging. Screenshots do not count as proof and judges know the difference.

**Do not promise streamed progress.** Graph workflows do not support live streaming
`[L1.20]`. Show real logs or a polled status. A faked progress stream is a lie a judge can
catch by reading the repository.

### FM-09 — Stage Three bonuses left unclaimed

**What it is.** Not doing roughly two hours of work worth up to +0.4 on a maximum final
score of 6 `[L3.7]`. Every earlier version of these docs omitted Stage Three entirely, which
made the loss invisible.

**Mitigation.** Two items on the Aug 30 checklist: publish the build write-up (+0.2, and the
material already exists in this tree) and post with `#AllThingsAgenticHackathon` (+0.2).
Extra Google AI models are worth +0.2 each up to +0.6 and are **not** planned — bolting on
Veo or Lyria to farm bonus points is FM-04 wearing a hat.

---

## 3. Win strategies

### Innovation & Operational Utility — 40%

The criterion favours eliminating *real-world friction* and rewards *autonomous execution
over simple chat queries*.

- **Six-node pipeline ending in two real commits.** The user pastes a URL and clicks once.
  Everything between is the agent's.
- **Four assets from one generation pass**, in one typed model with four fields — not four
  round trips. Most entries produce one generic summary.
- **The agent decides, and can decide no.** The path evaluator returns `FULL_PUBLISH` or
  `PRIVATE_ONLY` with reasons, at `temperature=0.0`. An agent that approves everything is a
  formatter with extra steps.
- **The learning loop.** Style rules move `PROPOSED` → `ACTIVE` → `INACTIVE` and change what
  the next generation produces, with no redeploy. This is the half of the pitch that most
  competitors will not have at all.

> ⬜ The **"45–60 minutes per project"** figure inherited from the original request has **no
> source** and is not used as a claim anywhere in the current docs. Say "an afternoon of
> reformatting" in the video, or measure it once on a real repository and cite that. Do not
> invent a number a judge might ask about.

### Architectural Discipline & Tech Stack — 30%

Scored explicitly on *"how well did your team decouple systems, manage state,"* and
**design failure-tolerant agents** `[L3.8]`.

That last clause is the one to build for. It means the §9 fallback matrix is **scored work,
not polish** — a fallback for every step is worth part of 30%, not zero.

- **Deterministic and LLM nodes as peers in one graph.** Scanning, rule attachment, and
  persistence are Python. Extraction, generation, and evaluation are model calls. The
  boundary is drawn where determinism is possible, not where it is convenient.
- **Firestore as the durable boundary between two phases.** Phase 1 ends by writing
  `PENDING_APPROVAL` and returning. Phase 2 is a separate HTTP entry point. No request
  thread is held open waiting for a human, so Cloud Run scaling to zero is harmless.
- **The rejected alternative, documented.** ADK's `RequestInput` node is the obvious way to
  do human-in-the-loop, and it was evaluated and rejected: pause durability across a
  container restart is undocumented, and Cloud Run scales to zero. The one thing that would
  have made it viable — a Firestore-backed session service — **exists only in ADK Java**
  `[L1.24]`. There is no supported Python route to a durable cross-restart pause.
- **Two independent commit flags**, so a partial failure is a partial success rather than an
  ambiguous one.

Under a criterion that scores engineering judgment, "we considered `RequestInput` and
rejected it, here is why" outscores an extra integration.

### Demo & Production Readiness — 30%

- **~4 minutes, five scenes**, scripted and rehearsed three times against live rate limits.
  Full storyboard: [demo/demo_storyboard_and_mistakes.md](../demo/demo_storyboard_and_mistakes.md).
- **The two scenes competitors will not have:** the negative result (early commit →
  `PRIVATE_ONLY`, final commit → `FULL_PUBLISH`) and the rule toggle → Regenerate.
- **README that gets a judge from clone to working request in under 10 minutes.**
- **Devpost text that addresses the three Stage Two criteria by name.** Judges are scoring
  against a list. Make the mapping trivial.

---

## 4. Rubric alignment

Stage Two is scored **1–5 per criterion**, weighted. There is no 100-point scale — the
"96/100 target" in the earlier version of this file was invented, along with its per-row
sub-scores.

| Criterion | Weight | What earns the top band | Evidence a judge can check |
|---|---|---|---|
| **Innovation & Operational Utility** | 40% | Real friction eliminated; autonomous multi-step execution; the agent exercises judgment | Two commit SHAs; `PRIVATE_ONLY` on an incomplete repo; rule toggle changes the draft |
| **Architectural Discipline & Tech Stack** | 30% | Decoupled systems, managed state, **failure-tolerant design** `[L3.8]` | Six-node graph with three code nodes; two-phase Firestore boundary; §9 fallback matrix; documented rejection of `RequestInput` |
| **Demo & Production Readiness** | 30% | Clear docs; *"undeniable proof of execution in the video pitch"*; visible GCP deployment | ~4-min live video; Firestore lifecycle on camera; Cloud Run logs; README |

**Stage One is the gate.** Correct model pin, ADK, ≥2 GCP services, public repo, video,
complete Devpost entry. Confirm each one against the shipped artefact on Aug 29.

**Stage Three is +0.4 for two hours.** Write-up plus tagged post.

---

## 5. Timeline integration

15 days. Phase boundaries from
[build/stack_and_timeline_engineering.md](../build/stack_and_timeline_engineering.md).

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              15-DAY RISK RETIREMENT MAP                              │
├──────────────────┬───────────────────────────────────────────────────────────────────┤
│ Aug 16 – Aug 22  │ Core loop. Retires FM-01, FM-03, FM-06                            │
│ Aug 23 – Aug 27  │ Phase 2, memory, fallbacks. Retires FM-02, FM-07                  │
│ Aug 28 – Aug 31  │ Deploy, demo, submit. Retires FM-05, FM-08, FM-09                 │
└──────────────────┴───────────────────────────────────────────────────────────────────┘
```

FM-04 (scope creep) is never retired. It is checked at the start of every day against the
out-of-scope list.

**Days 1–7 (Aug 16 – Aug 22) — core loop end to end**
1. Pin the model. Assert the pin at startup. **FM-01 retired first, because it is the only
   elimination-class risk.**
2. `pip install google-adk` and confirm the real import paths for `Workflow`, `Agent`,
   `Event`, and `RequestInput` against the installed package `[L1.7]`.
3. Scanner code node with the filters above. Then the three agent nodes. Build the graph
   from the cheatsheet's verified contracts — **FM-03 retired by construction.**
4. Deploy a trivial container to Cloud Run before the agent works — **FM-06 defused early,
   while IAM problems are cheap.**

**Days 8–12 (Aug 23 – Aug 27) — Phase 2, memory, resilience**
1. `POST /api/v1/approval-callback`, both commit paths, both independent flags.
2. Style rules end to end, plus the differ-on-toggle test — **FM-02 retired by a test, not
   by inspection.**
3. Fallback for every step in the §9 matrix. This is scored work under `[L3.8]`.
4. Failure suite: huge repo, revoked token, rate-limit recovery, missing README, malformed
   model output — **FM-07 retired.**

**Days 13–15 (Aug 28 – Aug 31) — proof and submission**
1. Full deployment. Rehearse the demo three times. Know the graph's real wall-clock time
   before pointing a camera at it.
2. Record. Console proof on camera — **FM-08 retired.**
3. Aug 29: re-read the rules page against the frozen artefact. Stage One confirmed.
4. Aug 30: write-up published, post tagged — **FM-09 retired.**
5. Submit before **Aug 31, 5:00 PM PT**. Not on it.

---

## 6. Open risks with no mitigation yet

Listed because an unlisted risk is worse than an unmitigated one.

| Risk | Status |
|---|---|
| GCP credit amount and request deadline both unverified `[L3.14]` | Re-check the rules page. Do not plan around either figure |
| ADK import paths unconfirmed — the package is not installed locally `[L1.7]` | Day 1, first hour |
| Cold-start latency on Cloud Run unmeasured | Measure during the first rehearsal, not during the recording |
| `gemini-3.7-flash` throughput on a large repository unmeasured | Measure on the real demo repository in week two |

---

_Last updated: 2026-08-16_
