# Demo Storyboard & Mistakes

> **Track**: Taskmaster · **Record**: Aug 29 · **Submit**: Aug 30 (deadline Aug 31, 5:00 PM PT)
> **Source of truth**: [projectsync_full_spec.md](../../projectsync_full_spec.md) · **Claims**: [VERIFICATION_LEDGER.md](../VERIFICATION_LEDGER.md)
> Workspace rules: [CONTEXT.md](CONTEXT.md)
>
> Rewritten 2026-08-16. The 2026-08-11 version scripted a Gmail inbox scene, a Pub/Sub
> architecture, `gemini-3.5-pro`, and a fabricated demo repository. None of those exist. It
> also had **no negative-result scene and no memory scene** — the two things that actually
> differentiate this build.

---

## The argument the video has to make

Demo & Production Readiness is **30%**, weighted the same as the entire architecture. The
criterion asks for *"undeniable proof of execution in the video pitch"* `[L3.5]`.

Most entries in this track will show a pipeline that calls an LLM and posts the result. To
beat them the video needs to show two things they cannot: **an agent that says no**, and
**an agent that changed its mind because of something the user taught it.**

Everything else in the script exists to make room for those two scenes.

| Constraint | Value |
|---|---|
| Length | **~4 minutes.** Not 5. Over-length risks the Stage One completeness check `[L3.6]` |
| Format | 1080p screen capture, clean audio, small webcam in a corner |
| Execution | **Live.** Real Cloud Run, real Firestore, real commits |
| Demo repository | **This project's own repository.** See §"Why our own repo" below |

---

## Why our own repo is the demo subject

The negative-result scene needs a repository that is *genuinely* incomplete at one commit and
complete at another. Faking that with a toy repo is obvious on camera and a judge will
suspect the whole run.

ProjectSync's own history supplies it for free: an early commit with no tests, no README, and
no licence, and a final commit with all three. Same repository, same agent, two different
verdicts — and the judge can click both commits.

**Action on Day 5 (Aug 20):** find that early commit SHA, run the evaluator against it,
confirm it returns `PRIVATE_ONLY`, and write the SHA down. If it returns `FULL_PUBLISH`, pick
an earlier commit. Do not discover this on recording day.

---

## The five scenes

| # | Time | Scene | Rubric |
|---|---|---|---|
| 1 | 0:00–0:25 | The problem | Innovation 40% |
| 2 | 0:25–1:40 | Paste URL → the graph runs | Innovation 40% + Architecture 30% |
| 3 | 1:40–2:20 | **The negative result** | Innovation 40% |
| 4 | 2:20–3:10 | **Toggle a rule → Regenerate** | Innovation 40% + Architecture 30% |
| 5 | 3:10–4:00 | Approve → two commits to portfolio-data → GCP console | Demo 30% |

---

### Scene 1 — The problem (0:00–0:25)

**Short.** The demo is the argument; the narration is not. Twenty-five seconds.

**On screen.** A finished repository in one tab. A portfolio site in another, whose newest
entry is months old. That contrast is the entire problem statement and it needs no
voiceover explaining it.

**Narration, roughly:**

> "I finished this project three weeks ago. It is not on my portfolio, it is not in my notes,
> and it is not on my resume — because cataloguing it means re-reading my own code and
> writing the same summary four different ways, at exactly the moment I want to start the
> next thing. So here is an agent that does it."

> ⬜ **Do not say a number.** The "45–60 minutes" and "4+ hours" figures in earlier versions
> of this doc have **no source**. Say "an afternoon of reformatting," or measure it once on a
> real project and cite that. An invented number is the kind of thing a judge asks about.

**Then:** paste the repository URL, click Run, **and take your hands off the keyboard,
visibly.** Hold them up. That gesture is the Taskmaster claim, made without a word.

---

### Scene 2 — The graph runs (0:25–1:40)

**On screen.** Split view. Left: the ProjectSync status view. Right: Cloud Run logs
streaming in the GCP console — real logs, not a rendered animation.

Node names appear as they complete. Six of them:

```
scan_github_repository    ▪ code    142 files → 38 relevant, 210 KB
extraction_agent          ● gemini-3.7-flash
attach_style_rules        ▪ code    4 ACTIVE rules loaded
asset_generator_agent     ● gemini-3.7-flash
path_evaluator_agent      ● gemini-3.7-flash    temperature 0.0
persist_transaction       ▪ code    → PENDING_APPROVAL
```

Then the four assets appear as editable drafts: KMS sheet, portfolio card, resume bullets,
social draft.

**Narration, roughly:**

> "My hands are off the keyboard. This is an ADK graph workflow on Cloud Run — seven nodes.
> Four of them are ordinary Python: the repository scan, loading my style rules, choosing
> what the evaluator reads, and the Firestore write. Three are Gemini 3.7 Flash calls. The scan filtered a hundred and
> forty-two files down to thirty-eight that carry signal, which is why this fits in one
> context window and does not cost a fortune. Four assets, one generation pass."

**Say "four of the seven nodes are plain Python" out loud.** It is the sentence that separates
this from a wrapper, and the architecture criterion is 30%.

> ⚠️ **Do not fake a progress stream.** Graph workflows do not support live streaming
> `[L1.20]`. Show real Cloud Run logs or a polled status. A fabricated stream is a lie a
> judge can catch by reading the repository — and they will read the repository.

---

### Scene 3 — The negative result (1:40–2:20)

**This is the scene most competitors will not have.** Forty seconds. Protect it.

**On screen.** Run the agent again, against an early commit of this same repository.

The verdict comes back **`PRIVATE_ONLY`**, with reasons:

```
PRIVATE_ONLY
  · No test directory
  · README is a single line
  · No LICENSE file
→ Catalogue this in the private KMS. Do not publish it to the portfolio yet.
```

Then switch to the final commit. Same repository, same agent, `temperature=0.0`:

```
FULL_PUBLISH
  · 24 tests across 3 files
  · README documents setup and architecture
  · Apache-2.0
```

**Narration, roughly:**

> "Same repository, an earlier commit. The agent refuses to publish it, and it says why — no
> tests, a one-line README, no licence. It still catalogues the work privately, because the
> notes are useful either way. It just will not put it on my public portfolio. The evaluator
> runs at temperature zero, so this is the same answer every time — you can run it yourself.
>
> Here is the final commit. Now it publishes. An agent that approves everything is a
> formatter with extra steps."

That last line is the one to land. It tells the judge you know what the difference is.

---

### Scene 4 — Toggle a rule → Regenerate (2:20–3:10)

**The second scene competitors will not have.** Fifty seconds.

**On screen.** The style-rules panel, showing rules the agent proposed from earlier edits:

```
ACTIVE     Do not open a post with "Excited to share"
ACTIVE     No em dashes
ACTIVE     Name the specific technical constraint, not the outcome
INACTIVE   Keep social drafts under 100 words
```

Toggle **"Keep social drafts under 100 words"** to `ACTIVE`. Click **Regenerate**.

The social draft is replaced by a shorter one. **No redeploy. No re-scan.** Show the word
count changing.

**Narration, roughly:**

> "These rules were not typed by me. The agent proposed them from edits I made to earlier
> drafts, and I approved them. Nothing becomes active on its own.
>
> Watch — I turn on the length rule and regenerate. The draft is rewritten and it is shorter.
> No redeploy, no re-scanning the repository. The rules are read at generation time by a
> Python node, not summarised by a model, so nothing is lost between the rule and the output.
> Every transaction records which rules were applied to it."

**Why this is worth fifty seconds.** It is the hardest thing on the differentiators list for
a competitor to bolt on late, and the easiest to prove in under a minute.

> ⚠️ Rehearse this scene most. It is the one where "it looks like it worked but nothing
> changed" is a real failure mode — see Mistake 2.

---

### Scene 5 — Approve, two commits, console proof (3:10–4:00)

**On screen, in this order:**

1. **Click Approve.** One click.
2. **The `portfolio-data` repository** — first commit at `docs/synced/{slug}.md`.
   Click into it. Frontmatter and markdown rendering. This is the documentation sheet.
3. **The same `portfolio-data` repository** — second commit, `cards/{slug}.json`. The
   portfolio card is JSON, not markdown. Both commits go to the same private repository.
   (Make it public for the recording so a judge can click both commits.)
4. **Firestore in the GCP console** — refresh the transaction document in
   `projectsync_transactions`. `status` reads `COMPLETED`. `doc_commit_sha` and
   `card_commit_sha` both populated. `style_rules_applied` lists the four rules from Scene 4.
5. **Cloud Run** — the revision serving live traffic, with the request spikes matching what
   just happened on camera.

**Narration, roughly:**

> "One click. Two commits, both landing in `portfolio-data`. The documentation sheet is
> markdown, the portfolio card is JSON — different formats, different folders, one private
> repository that my portfolio site builds from. The scanned repository is never written to.
>
> In Firestore the transaction has moved from pending approval to completed, with both commit
> SHAs and the exact list of style rules that shaped this draft. And here is the Cloud Run
> revision that served it, with the request spikes from the last four minutes.
>
> ADK graph workflow, Gemini 3.7 Flash, Cloud Run, Firestore. It writes the entry, it decides
> whether the work is ready to be public, and it gets closer to my voice every time I correct
> it."

**Two commit SHAs in one repository is the proof.** Not a screenshot, not a log line.
Everything else in scene 5 supports that.

> 💡 **Consider making `portfolio-data` public before recording.** Spec §10.1 chose private,
> but the stated reason was *"no hosting, no webhook, buildable now"* — not confidentiality.
> The contents are portfolio cards describing the user's own public projects. Making it public
> costs nothing and lets a judge click both commits on camera. **This is a suggestion, not a
> spec change** — if the repo stays private, do not tell the judge they can click it.

---

## Scene → rubric map

| Scene | What a judge can verify | Criterion |
|---|---|---|
| 1 | The friction is real and specific | Innovation 40% |
| 2 | Autonomous multi-step execution; three deterministic nodes; live Cloud Run | Innovation 40% + Architecture 30% |
| 3 | The agent exercises judgment and can refuse. Reproducible at `temperature=0.0` | Innovation 40% |
| 4 | Persistent memory that changes behaviour, with an audit trail | Innovation 40% + Architecture 30% |
| 5 | *"Undeniable proof of execution"* `[L3.5]` — two commits to `portfolio-data`, Firestore lifecycle, Cloud Run | Demo 30% |
Nothing in the video shows Pub/Sub, Gmail, or an email inbox. **They were cut.** A scene
showing them would contradict the repository a judge is about to read.

---

## Mistakes

### 1. The chatbot trap

**How it happens.** A message thread and a send button, because that is the default shape for
anything with an LLM in it. The track brief is literally *"Build a Complete Workflow, Not
Just a Chatbot,"* and the criteria favour *"high-value, autonomous execution over simple chat
queries."*

**Prevention.** One form field taking a URL. One approval click. Four editable drafts. No
thread, no send button, no assistant turn.

**Recovery, if the UI is already a chat.** Keep the graph; replace the surface. The status
view is a polled `GET /api/v1/transactions/{id}` and a list of drafts. That is an afternoon,
not a rewrite.

### 2. Memory theatre

**How it happens.** The rules are read, stored, displayed, and toggled — and never reach the
model. The demo looks fine. The single most differentiating feature is a prop.

**This was a real bug in this project's plan — twice over.** The generator's instruction read
`{style_rules}` as a bare state key. The first fix replaced it with `{AssetGenInput.style_rules}`,
which is **worse**: a dotted name fails the engine's state-name check and reaches the model as
literal braces, and nothing raises `[L1.28]`. Either way the rules would have rendered as text.

**Prevention.** A code node attaches the rules into `AssetGenInput`, and the generator uses
**no template at all** — a graph agent node receives its input model as JSON user content, so
the rules are already in front of the model. And the test that actually catches it:

```python
def test_style_rules_change_output():
    """A toggled rule must change the next draft.

    A test that only shows that generation did not fail cannot tell a working
    memory system from a demonstration of one.
    """
    set_rule_state(rule_id, "INACTIVE")
    before = generate(fixture_metadata)
    set_rule_state(rule_id, "ACTIVE")
    after = generate(fixture_metadata)
    assert before.social_draft != after.social_draft
```

**Recovery.** If Scene 4 does not visibly change the draft during rehearsal, do not narrate
around it. Fix the binding or cut the scene — a scene that claims a change the viewer cannot
see is worse than no scene.

### 3. No live GCP proof

**How it happens.** A polished UI recording that never leaves the app. Or worse, hardcoded
fixtures in the execution path so the "live" run is a replay.

**Prevention.** Scene 5, on camera, unedited: two commits clicked through, Firestore
refreshed in the console, Cloud Run revision serving traffic. Before recording, open those
console tabs and log in. No stubbed return values anywhere in the request path.

**Recovery.** If deployment is not ready, record local execution with real GCP credentials and
real Firestore writes, and **say** it is local. Judges score honesty better than a
convincing fake — and a fake is discoverable from the repository.

### 4. Exposed secrets

**How it happens.** A terminal in frame with `GITHUB_TOKEN=ghp_...` in the scrollback. Or a
`.env` open in the editor. Or `C:\Users\DELL\...` in a committed path.

**Prevention.** `.gitignore` before the first commit. Secret Manager in production. Clear the
terminal before recording. Scan the repository with `trufflehog` or `git-secrets` before it
goes public. Relative paths via `pathlib`, never absolute.

**Recovery, if a secret is already committed.** Revoke it first — that is the only step that
matters immediately. Then purge history with `git-filter-repo`, then force-push. Revoke
before you clean; a cleaned history with a live token is still a leaked token.

### 5. Scope creep

**How it happens.** M5 auto-posting, or a second agent, or bonus-point Veo integration, in
the last week.

**Prevention.** Feature freeze on **Aug 27**, end of Phase 2. The out-of-scope list in
[research/problem_statements.md](../research/problem_statements.md) has a written reason per
item, which is harder to relitigate at 2 a.m. than an unwritten one.

**Recovery.** The cut order is already decided in
[build/stack_and_timeline_engineering.md](../build/stack_and_timeline_engineering.md) §6:
curator agent → auto-approve → portfolio commit → dashboard polish. **Scenes 3 and 4 are
never cut.**

### 6. Over-length video

**How it happens.** Narration expands to fill the available silence, and the two
differentiating scenes get compressed to make room.

**Prevention.** Write the narration out and time it before recording. It will be too long on
the first pass — cut the *narration*, not the scenes. Scene 1 is the one that can lose ten
seconds; Scenes 3 and 4 are not.

**Why it matters.** Over-length risks the pass/fail Stage One completeness check `[L3.6]`, and
that gate is binary.

### 7. Wrong model on screen

**How it happens.** A log line, a config file, or a console page showing
`gemini-3-flash-preview` — which is **below the mandated 3.5 floor** `[L2.3]`.

**Prevention.** The model is pinned in `config.py` and asserted at startup. Before recording,
grep the whole repository for stale model strings. Any Vertex AI console page that appears on
camera must show `gemini-3.7-flash`.

**Why it is here and not lower.** Stage One is pass/fail. This is elimination, not a
deduction — the highest-severity item on this list, and the easiest to leave lying around.

---

## Pre-record checklist

Run this the morning of Aug 29.

- [ ] **Full dry run, three times.** Know the graph's real wall-clock time and cold-start
      latency. A live scan that 403s on camera is an avoidable disaster
- [ ] `GITHUB_TOKEN` set, scope `repo` — unauthenticated is 60 requests/hour and the demo will
      exhaust it
- [ ] **Early commit SHA confirmed to return `PRIVATE_ONLY`** (found on Day 5)
- [ ] **Scene 4 rehearsed** — the draft visibly changes on toggle
- [ ] `portfolio-data` exists, and the token can write to it
- [ ] Decided whether `portfolio-data` is public for the recording. If it stays private, the
      narration must not claim a judge can click that commit
- [ ] Firestore console open on the `projectsync_transactions` collection
- [ ] Cloud Run logs open, filtered to the service
- [ ] Terminal cleared. No `.env` open. No secrets in any frame
- [ ] Every visible model string reads `gemini-3.7-flash`
- [ ] Narration written out and **timed under 4:00**
- [ ] Notifications off. Bookmarks bar cleared

## Post-record

- [ ] Watch it once at full length. Anything over 4:00 gets cut from *narration*
- [ ] Both commit SHAs legible when paused
- [ ] Firestore `PENDING_APPROVAL` → `COMPLETED` legible
- [ ] No secrets in any frame — check the scrollback frame by frame
- [ ] Upload. Devpost text addresses the three Stage Two criteria **by name**
- [ ] **Stage Three, +0.4** `[L3.7]`: build write-up published, post tagged
      `#AllThingsAgenticHackathon`
- [ ] **Submit Aug 30.** Aug 31 is buffer, not a plan

_Last updated: 2026-08-16_
