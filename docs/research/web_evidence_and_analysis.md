# Web Evidence & Competitive Analysis

> Sources re-verified **2026-08-16**. Supersedes the 2026-08-11 pass.
> Claim audit: [VERIFICATION_LEDGER.md](../VERIFICATION_LEDGER.md) · Demo script: [demo/demo_storyboard_and_mistakes.md](../demo/demo_storyboard_and_mistakes.md)

---

## 1. Official links

### Hackathon
| Resource | URL |
|---|---|
| Home | `https://allthingsagentichackathon.devpost.com/` |
| Rules & criteria | `https://allthingsagentichackathon.devpost.com/rules` |
| Resources & credits | `https://allthingsagentichackathon.devpost.com/resources` |

### ADK
> ⚠️ **All `google.github.io/adk-docs/*` links are dead** — they 301-redirect to `adk.dev` `[L1.27]`. Every ADK URL in the 2026-08-11 version of this file used the retired host. Append `/index.md` to any `adk.dev` page for raw markdown.

| Resource | URL |
|---|---|
| Documentation | `https://adk.dev/` |
| **Graph workflows** — the engine we build on | `https://adk.dev/graphs/index.md` |
| **Data handling** — the most load-bearing page | `https://adk.dev/graphs/data-handling/index.md` |
| Cloud Run deploy | `https://adk.dev/deploy/cloud-run/index.md` |
| Python SDK | `https://github.com/google/adk-python` |
| Runnable samples | `https://github.com/google/adk-samples` |
| Dev UI | `https://github.com/google/adk-web` |
| PyPI (**2.7.0**) | `https://pypi.org/project/google-adk/` |

Full annotated index: [adk_framework_reference_digest.md](adk_framework_reference_digest.md).

### Deploy command
```bash
gcloud run deploy projectsync --source . --region us-central1
```

---

## 2. Rubric mapping — corrected

The earlier version of this file described the rubric as three weighted criteria. That is right as far as it goes, and it **misses the two things most likely to decide the outcome**.

### Stage One — pass/fail, before any score `[L3.6]`

A completeness check on submission artefacts. No score is assigned until it passes. This is what turns "we used Gemini 3 Flash instead of 3.5" from a style note into an elimination — and it is why the model pin was the single most important thing fixed in this doc tree.

### Stage Two — scored 1–5 per criterion

| Criterion | Weight | What they look for | How ProjectSync answers it |
|---|---|---|---|
| Innovation & Operational Utility | **40%** | *"eliminate real-world friction"*; favours *"high-value, autonomous execution over simple chat queries"* | Six-node pipeline ending in two real commits. The user's involvement is one click. Plus a learning loop that changes future output |
| Architectural Discipline & Tech Stack | **30%** | *"How well did your team decouple systems, manage state,"* and **design failure-tolerant agents** `[L3.8]` | Graph with deterministic code nodes and LLM nodes as peers; a two-phase state machine with Firestore as the durable boundary; a fallback for every step; two independent commit flags |
| Demo & Production Readiness | **30%** | Documentation clarity, *"undeniable proof of execution in the video pitch,"* visible GCP deployment | Two clickable commit SHAs; Firestore lifecycle visible in the console; README that gets a judge running in under 10 minutes |

> The phrase **"design failure-tolerant agents"** is in the official criteria. That single clause is why spec §9's fallback matrix is scored work and not polish — it is worth part of 30%, not zero.

### Stage Three — bonuses, max final score 6 `[L3.7]`

| Bonus | Value | Cost to us |
|---|---|---|
| Published build write-up | +0.2 | ~2 hours. The doc tree already contains the material |
| Post tagged `#AllThingsAgenticHackathon` | +0.2 | ~15 minutes |
| Each extra Google AI model (Gemma, Veo, Lyria) | +0.2 each, capped +0.6 | Not planned — would be scope creep |

**Up to +0.4 for roughly two hours of work.** The 2026-08-11 version of this file omitted Stage Three entirely, which meant that score was invisible and would simply have gone unclaimed.

---

## 3. Timeline

| Milestone | When | Days from Aug 16 |
|---|---|---|
| Submission window opened | Aug 3, 2026, 9:00 AM PT | — |
| GCP credit request deadline | Aug 28, 2026, 12:00 PM PT | ⬜ **unverified** — see below |
| **Submission deadline** | **Aug 31, 2026, 5:00 PM PT** | **15 days** |
| Judging | Sept 1 – Oct 1, 2026 | — |
| Winners announced | on or around Oct 8, 2026 | — |

> ⬜ **The "$150 credit" figure has no confirmed source** `[L3.14]`. What is verified is a **$24,500 GCP credit pool** across the whole event. The per-participant amount and the request deadline both need re-checking on the rules page before anything is planned around them. Approvals were said to take up to 72 business hours — also unverified.

---

## 4. Competitive positioning

No competitor research was actually performed for the earlier version of this file, despite its title. Rather than invent a landscape, here is the honest read on what the field will look like and where this build differs.

**What most submissions in this track will be.** A pipeline that calls an LLM two or three times and posts the result somewhere. Working, demoable, and indistinguishable from the next one.

**Three things that separate ProjectSync, in descending order of how hard they are to copy:**

1. **The learning loop.** Most entries have no memory at all. ProjectSync's style rules change what the next generation produces, live, with no redeploy — and the demo shows exactly that: toggle a rule, hit Regenerate, watch the draft change. This is the hardest thing on this list to bolt on late, and the easiest to show in 20 seconds.

2. **The negative result.** Running the evaluator against an early, genuinely incomplete commit of ProjectSync's own repo returns `PRIVATE_ONLY`; the final commit returns `FULL_PUBLISH`. An agent that says no is evidence of judgement. An agent that approves everything is a formatter with extra steps, and every judge knows it.

3. **Deliberate subtraction, stated out loud.** Pub/Sub, Gmail OAuth2, vector memory, and cron were all evaluated and cut, each with a written reason. Under a criterion that scores *engineering judgment*, being able to say "we considered `RequestInput` and rejected it because cross-restart durability is undocumented and Cloud Run scales to zero" is worth more than an extra integration.

**Where we are weak, stated honestly:** no multimodal component, so Best Multimodal UX is out of reach; a single-user build, so Startup Excellence is not a fit; and the dashboard will look plainer than entries that spent their time on UI.

---

## 5. Demo script

Moved. It lives in [demo/demo_storyboard_and_mistakes.md](../demo/demo_storyboard_and_mistakes.md) — one copy, one place.

> The version in the 2026-08-11 file was built on the cut architecture: a Gmail inbox scene at 1:45–2:30 and an architecture diagram ending in `Event → Pub/Sub → Cloud Run`. Neither exists now. If you find that script anywhere, it is stale.

_Last updated: 2026-08-16_
