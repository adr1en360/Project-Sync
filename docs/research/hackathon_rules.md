# Hackathon Rules — All Things Agentic

> Source: https://allthingsagentichackathon.devpost.com/rules and the event home page
> Verified: **2026-08-16** (supersedes the 2026-08-10 pass, which carried a fabricated prize table)
> Claim-by-claim audit: [VERIFICATION_LEDGER.md](../VERIFICATION_LEDGER.md) §3

## Timeline
| Milestone | Date | Notes |
|-----------|------|-------|
| Submission window opens | Aug 3, 2026, 9:00 AM PT | Verified — earlier note said Aug 4 |
| Submission deadline | **Aug 31, 2026, 5:00 PM PT** | Hard cutoff |
| Judging | Sept 1 – Oct 1, 2026 | Verified — previously logged "TBD" |
| Winners announced | On or around Oct 8, 2026 | |
| GCP credit request deadline | Aug 28, 2026, 12:00 PM PT | ⬜ **unverified this pass** — re-check before relying on it |

## Mandatory Tech Stack
All three required, verbatim from the rules page ("Mandatory for all categories", joined by AND):

1. **"Gemini 3.5 or newer accessed through Gemini API or Vertex AI"**
2. **"at least one Google Agent Framework: Google ADK, GenAI SDK, Antigravity SDK or GenKit"**
3. **"at least one Google Cloud infrastructure service (such as Cloud Run, Cloud SQL, Firestore, GKE, Pub/Sub)"**

> ⚠️ **The model floor is a hard gate.** `gemini-3-flash-preview` is Gemini **3** Flash and sits *below* the 3.5 floor — it fails requirement 1. `gemini-3-pro-preview` has been shut down. ProjectSync pins **`gemini-3.7-flash`** (newest stable). See ledger §2.
>
> ProjectSync satisfies (2) with ADK graph `Workflow` and (3) with Cloud Run + Firestore — two services, one more than required.

The brief also asks for an agent "that operates beyond standard chat loops," able to run asynchronously in the background.

## Tracks (choose exactly one)
| Track | Focus |
|---|---|
| **Taskmaster** ← locked | "Build a Complete Workflow, Not Just a Chatbot" — identify a messy, multi-step chore, build an agent that manages the details and routes the right information to the right destinations |
| Collaborative Partner | Asks clarifying questions, guides step-by-step, has a defined feedback-capture mechanism |
| Fortified Enterprise Fleet | Institutional agent fleets — registry, runtime/memory, identity/gateway/Model Armor, observability |

## Judging

**Stage One — pass/fail completeness check.** No score at all until submission artifacts are complete. This is what makes the model-version rule fatal rather than cosmetic.

**Stage Two — scored 1–5 per criterion:**

| Criterion | Weight | What they look for |
|-----------|--------|-------------------|
| Innovation & Operational Utility | 40% | Does it "eliminate real-world friction"? Favours "high-value, autonomous execution over simple chat queries" |
| Architectural Discipline & Tech Stack | 30% | Engineering judgment, not just API calls: "How well did your team decouple systems, manage state," and **design failure-tolerant agents** |
| Demo & Production Readiness | 30% | Documentation clarity plus "undeniable proof of execution in the video pitch," including visible Google Cloud deployment |

> The explicit "design failure-tolerant agents" language is why spec §9 (failure fallbacks) is **scored work, not polish**.

**Stage Three — bonuses (max final score 6):**
| Bonus | Value |
|---|---|
| Published build write-up | up to +0.2 |
| Social post tagged `#AllThingsAgenticHackathon` | up to +0.2 |
| Each extra Google AI model (Gemma, Veo, Lyria) | +0.2 each, capped +0.6 |

> Up to **+1.0** of essentially free score. Earlier versions of this doc omitted the bonus system entirely. The write-up and social post are near-zero-cost — claim both.

## Prize Pool — $180,000 cash (+ $24,500 GCP credits)
| Prize | Amount | Count |
|-------|--------|-------|
| Grand Prize | $50,000 | 1 |
| Category prize (per track) | $20,000 | 3 |
| Startup Excellence | $20,000 | 1 |
| Individual/Hobbyist | $10,000 | 2 |
| Best Architectural Design | $5,000 | 2 |
| Best Multimodal UX | $5,000 | 2 |
| Honorable Mention | $2,000 | 5 |

Each project can win **only one** prize. Non-cash perks include a virtual coffee with a Google team member and social promotion.

> ❌ **Corrected:** the prior version of this file listed "1st/2nd/3rd place per track," a "Best Use of ADK $10,000" prize, and a "Best Use of Gemini API $10,000" prize. **None of those exist.** Do not aim strategy at them.

**Realistic solo target:** Individual/Hobbyist ($10K, 2 slots) + Taskmaster category ($20K) + Best Architectural Design ($5K, 2 slots — directly reachable via the failure-fallback and decoupling work).

## Submission Requirements
| Artifact | Required | Notes |
|----------|----------|-------|
| Demo video | YES | ~4 min, must show live deployment proof (Cloud Run, Vertex AI logs, Firestore) |
| Code repository | YES | Public, README + setup instructions |
| Architecture diagram | YES | Agent flow, GCP services, data paths |
| Text description | YES | Problem, approach, tech stack, what makes it innovative |
| Hosted URL | ENCOURAGED | Not strictly required |

## Eligibility
⬜ **Carried from the 2026-08-10 check, not re-verified 2026-08-16.** Re-confirm before submitting.
- Open globally, 18+; Nigeria eligible (not on the excluded list)
- Excluded: Italy, Quebec, Crimea, Cuba, Iran, Syria, North Korea, Sudan, Belarus, Russia, OFAC-designated
- Solo or team up to 5; one track only

## Action Items
- [ ] Re-verify eligibility + the GCP credit amount and deadline directly on the rules page
- [ ] Request GCP credits
- [ ] Register on Devpost
- [ ] Plan the build write-up and the `#AllThingsAgenticHackathon` post (+0.4 combined)

> ~~Known issue: rules page shows mismatched track names~~ — **resolved.** The current page shows Taskmaster / Collaborative Partner / Fortified Enterprise Fleet correctly.

_Last updated: 2026-08-16_
