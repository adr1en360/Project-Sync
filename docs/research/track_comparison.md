# Track Comparison: Taskmaster vs. Collaborative Partner

> Decision status: **CLOSED — Taskmaster.** Locked 2026-08-10, rationale in [track_decision.md](track_decision.md).
> This file is kept as the reasoning record: it shows the alternative was actually evaluated, not defaulted into.
> Re-checked 2026-08-16 — no factual corrections needed. Only the timing note in §"Solo build time"
> predates the current 15-day window (Aug 16 → Aug 31).

---

## Track 1: The Taskmaster

### What the track asks for
An agent that autonomously completes multi-step tasks end-to-end with minimal human intervention.
Think: event-driven workflow — a trigger fires, the agent chains actions across tools, and the task
is done without you babysitting each step.

### Track-specific judging emphasis
- Agent must **do** something observable — not just generate text
- Multi-step execution chain must be visible in the demo
- Autonomy is the bar: "did it finish without human guidance?"

### What a winning submission looks like
- Clear trigger → action chain → completion loop
- Real integrations (APIs, databases, external services)
- Error handling when steps fail mid-chain
- Observable progress (logging, status updates)

### Solo feasibility: HIGH
- Scope is naturally bounded — one workflow, one trigger, one completion state
- Demo is clean: "watch the agent do this whole thing by itself"
- Architecture is straightforward: trigger → ADK agent → tool calls → Firestore state → done
- Cloud Run + Firestore is a natural fit

### The hard part
- Finding a **real** multi-step chore that isn't trivially solved by existing tools
- The agent has to actually touch external systems, not just shuffle data internally
- "Autonomous" means error recovery, not just happy-path execution

### Problem statement candidates
**Need your input here.** The best Taskmaster idea comes from a real friction you have.
Pattern to fill: "Every time [trigger happens], I have to [step 1], then [step 2], then [step 3],
and it's annoying because [reason]."

Some starter prompts (your real friction beats all of these):
1. **Freelancer invoice pipeline**: New project completion → generate invoice from time logs → send to client → track payment status → send reminder if overdue
2. **Content publishing pipeline**: Finished draft → format for platform → generate social posts → schedule across channels → track engagement
3. **Job application tracker**: New job posting found → tailor resume highlights → draft cover letter → submit → log status → follow up after N days
4. **Meeting action extractor**: Meeting recording uploaded → transcribe → extract action items → create tasks in project management tool → assign to people → send summary

---

## Track 2: The Collaborative Partner

### What the track asks for
An agent that works **alongside** a human, adapting to their style and preferences over time.
Not a one-shot assistant — a persistent collaborator that gets better the more you use it.

### Track-specific judging emphasis
- **Persistent memory** that changes agent behavior across sessions
- Must demonstrate learning: "on day 5, it works differently than day 1"
- The agent must adapt to the **specific user**, not just have good defaults
- "Learns your brand preferences from your corrections" is their example

### What a winning submission looks like
- Session 1: agent operates with defaults
- Session 2+: agent recalls corrections and applies them without being told
- Memory architecture is visible in the demo (show Firestore, show preference evolution)
- The user can see and manage what the agent "remembers"

### Solo feasibility: MODERATE
- The core logic is tractable — Firestore for memory, retrieval for context injection
- The **hard part** is proving "adaptation" in a 4-minute video without it looking scripted
- UX matters more here — the agent needs a surface where the human interacts naturally
- Risk of looking like "ChatGPT with a database" if the memory isn't doing something non-obvious

### The hard part
- Demonstrating real adaptation, not just "it remembers what I said"
- The memory system needs to be more than key-value storage — it needs to influence **behavior**
- "Writing assistant that learns your style" is a crowded space (Notion AI, Grammarly, Lex, Cursor)
- You need a specific angle that makes the adaptation visible and non-trivial

### Problem statement candidates (from your Claude conversation)
You mentioned: "Something like project highlights but for writing, not for reading."
An agentic writing partner that:
- Lives inline where you're already typing
- Has LLM access and can make direct edits (not just suggestions)
- Remembers specific corrections across sessions

**The critical question (from Claude's analysis):**
What specifically should the agent remember and get better at?
Not "writing style" in the abstract — the concrete signal. Examples:
- Your argument structure patterns
- Vocabulary preferences (e.g., you hate em dashes)
- Tendency to overwrite in specific sections
- Tone shifts for different audiences
- Recurring structural choices (bullet points vs. paragraphs for certain content)

---

## Side-by-Side Scoring (Against Judging Rubric)

| Factor | Taskmaster | Collaborative Partner |
|--------|-----------|----------------------|
| **Innovation (40%)** | Medium — depends entirely on the problem you pick | Medium-High — IF the memory system is genuinely novel |
| **Architecture (30%)** | High — clean, standard pattern: trigger→agent→tools→state | Medium — memory architecture needs more design thought |
| **Demo Quality (30%)** | High — "watch it work" is visually compelling | Medium — harder to show "it learned" vs. "I scripted this" |
| **Solo build time** | ~2 weeks code + 1 week demo | ~2.5 weeks code + 0.5 week demo |
| **Risk of looking generic** | Low if problem is specific | High if it's "AI writing assistant" |
| **Risk of scope creep** | Low — bounded by the workflow steps | Medium — "what should it remember?" can expand forever |

---

## Decision Framework

**Pick Taskmaster if:**
- You have a real multi-step chore that's genuinely annoying
- You want the clearest path to a clean demo
- You prioritize reducing execution risk over maximizing innovation score

**Pick Collaborative Partner if:**
- You have a concrete, specific answer to "what should it remember and adapt to?"
- You're confident you can demonstrate real behavior change in a 4-min video
- You want to compete on innovation score and are willing to accept more UX risk

---

## Your Move

Before this decision can close, you need to answer:

### For Taskmaster:
> "Every time _________ happens, I have to _________, then _________, then _________, and it's annoying because _________."

### For Collaborative Partner:
> "The specific thing the agent should remember and apply without being told again is _________."

Whichever one you can fill in with a concrete, specific answer — that's your track.
