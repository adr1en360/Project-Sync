# Demo

## What This Workspace Is For
Everything a judge actually sees: the demo video script, the architecture diagram, the README, and the Devpost submission text. The build can be perfect and still score badly here — Demo & Production Readiness is **30%** of the score, weighted the same as the entire architecture `[L3.5]`.

Active window: **Aug 28 – Aug 31**. Do not record before the core loop and the fallbacks work.

## Process
1. **Architecture diagram** — after the graph runs end to end, not before. Must show the six nodes, both GCP services, the model, and the two commit destinations.
2. **Script the 5 scenes** (below). Write the narration out. Time it. It will be too long on the first pass.
3. **Dry-run the demo three times.** Live scans fail on rate limits and cold starts. Know exactly how long the graph takes before you point a camera at it.
4. **Record.** ~4 minutes. Live execution, visible GCP console.
5. **README** — clone to working request in under 10 minutes.
6. **Devpost text** — address the three Stage Two criteria explicitly, by name.
7. **Claim the Stage Three bonuses:** publish the build write-up (+0.2) and post with `#AllThingsAgenticHackathon` (+0.2) `[L3.7]`.

## Files In Here
- **⭐ `demo_storyboard_and_mistakes.md`** — the 5-scene script and the mistakes list.
- `CONTEXT.md` — this file.

Still to create in the final week:
```
demo/
├── architecture_diagram.md    # Mermaid source
├── submission_text.md         # Devpost description
└── assets/                    # screenshots, exports
```

## The five scenes

| Time | Scene | The point |
|---|---|---|
| 0:00–0:25 | The problem | Finished repo, stale portfolio. Short — the demo is the argument, not the narration |
| 0:25–1:40 | Paste URL → graph runs | Hands off the keyboard. Cloud Run logs visible. Four assets appear |
| 1:40–2:20 | **The negative result** | Run against an early incomplete commit → `PRIVATE_ONLY` with reasons. Then the final commit → `FULL_PUBLISH` |
| 2:20–3:10 | **Toggle a rule → Regenerate** | The draft changes. No redeploy, no re-scan. This is the learning loop, and it is the hardest thing for a competitor to fake |
| 3:10–4:00 | Approve → two commit SHAs → GCP console | Click through to both commits on GitHub. Firestore row `PENDING_APPROVAL` → `COMPLETED` |

Scenes 3 and 4 are the two that competitors will not have. Do not let them get squeezed to make room for narration.

## What Good Output Looks Like
- **Two clickable commit SHAs on screen**, in two different repositories. This is the proof — not a screenshot, not a log line.
- The agent visibly **refuses** to publish something incomplete, and says why.
- A style rule toggle visibly changes the next draft, on camera, with no redeploy.
- Firestore lifecycle shown live in the console: `PENDING_APPROVAL` → `COMPLETED`.
- No dead air. No talking head. The agent is doing something in every shot.

## Constraints
- **~4 minutes.** Not 5. Over-length risks the Stage One completeness check `[L3.6]`.
- Live proof of GCP deployment must be **on camera** — the criteria ask for *"undeniable proof of execution in the video pitch"* `[L3.5]`.
- **Do not promise streamed progress.** Graph workflows do not support live streaming `[L1.20]`. Show logs or a polled status, not a fake stream.
- Diagram must name the real stack: `gemini-3.7-flash`, ADK graph `Workflow`, Cloud Run, Firestore. **No Pub/Sub and no Gmail** — they were cut, and a diagram showing them contradicts the code.
- The social post asset is a **draft the user copies**. Never show it auto-publishing; that is the opposite of the product's promise.
- Rehearse against rate limits. A live GitHub scan that 403s on camera is an avoidable disaster.

_Last updated: 2026-08-16_
