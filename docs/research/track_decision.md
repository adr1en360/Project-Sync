# Track Decision

> Status: **LOCKED** — Taskmaster
> Decided 2026-08-10 · prize table and timeline corrected 2026-08-16

## Decision

**Track: Taskmaster** — *"Build a Complete Workflow, Not Just a Chatbot."*

The brief asks for an agent that identifies a messy, multi-step chore, manages the details, and routes the right information to the right destinations. ProjectSync is that description almost literally: a chore nobody enjoys, six steps, two destinations, one approval.

## Problem statement

> Finishing a project and recording it are two different jobs, and only the first one is fun. Cataloguing means re-reading your own code, writing an overview, reformatting it for a portfolio, compressing it into resume bullets, and drafting a post — at the exact moment you want to start the next thing. So it does not happen, and portfolios go stale.

ProjectSync turns a finished GitHub repository into career-ready outputs with one human approval, and gets better at the user's voice over time.

*(This was "TBD — waiting for user input" until the spec locked on Aug 15. It is now settled.)*

## Rationale

- **Bounded scope for a solo build.** 15 working days remain (Aug 16 → Aug 31, 5:00 PM PT). The core loop is achievable in the first week, which leaves real time for fallbacks and the demo.
- **The demo proves itself.** Two commit SHAs in two repositories a judge can click. Not a screenshot, not a log.
- **It maps cleanly onto the mandatory stack.** ADK graph `Workflow` satisfies the framework requirement; Cloud Run + Firestore satisfies the infrastructure requirement with one service to spare `[L3.2]`.
- **It is not a wrapper.** Three code nodes doing deterministic work, a real state machine across two phases, and a learning loop that changes future output. A chat wrapper has none of those.
- **The rubric rewards what this build is made of.** Architectural Discipline is 30% and is scored explicitly on decoupling, state management, and *"design failure-tolerant agents"* `[L3.8]` — which is why the §9 fallback matrix is scored work, not polish.

## Tracks not chosen

| Track | Why not |
|---|---|
| Collaborative Partner | Requires clarifying questions and a defined feedback-capture mechanism. ProjectSync's whole value proposition is *one* interaction, not a dialogue. Fighting that would weaken the product |
| Fortified Enterprise Fleet | Wants agent registries, identity, gateway, Model Armor, observability across a fleet. A solo build in 15 days cannot do this credibly, and a thin attempt scores worse than a solid single-agent build |

## Prize targets

> ❌ **The prize table in this file was fabricated** (track 1st/2nd/3rd at $15K/$10K/$5K, "Best Use of ADK," "Best Use of Gemini API"). **None of those prizes exist** `[L3.10]`. Verified table: [hackathon_rules.md](hackathon_rules.md).

Realistic targets from the actual prize list:

| Prize | Amount | Slots | Why reachable |
|---|---|---|---|
| Taskmaster category | $20,000 | 1 | The track we are in |
| Individual/Hobbyist | $10,000 | 2 | Solo entry, two slots available |
| Best Architectural Design | $5,000 | 2 | Directly earned by the decoupling and failure-fallback work |

One prize per project. Plus up to **+1.0** bonus score from the build write-up, the `#AllThingsAgenticHackathon` post, and extra Google AI models `[L3.7]` — the first two cost almost nothing and were omitted from every earlier version of these docs.

_Last updated: 2026-08-16_
