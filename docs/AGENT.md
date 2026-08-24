# ProjectSync — Agent Routing & Documentation

## Identity
Solo builder (`adrienoke`), full-stack AI developer, Nigeria. Track: **Taskmaster** (locked).
**One line:** turns a finished GitHub repository into career-ready assets in one click, and gets better at the user's voice over time.
Stack: `gemini-3.7-flash` | ADK 2.0 graph `Workflow` (`google-adk` 2.7.0) | Cloud Run + Firestore | Python 3.12 | `uv` | React 19 + Vite

## Documentation Map

| File | Purpose |
|---|---|
| [README.md](README.md) | Documentation index and quickstart commands |
| [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md) | Complete explanation of the 7-node DAG, models, and adaptive Curator agent |
| [API_REFERENCE.md](API_REFERENCE.md) | Full FastAPI REST API reference for Phase 1, Phase 2, Bullets, Rules, & Social |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Google Cloud Run, Cloud Firestore, and environment deployment guide |
| [devpost_submission.md](devpost_submission.md) | Official hackathon submission text and media links |

## Hard Rules
- Model is `gemini-3.7-flash`. Never below Gemini 3.5 — that is a mandatory **pass/fail** submission gate.
- Exactly 2 GCP services: Cloud Run + Firestore.
- Style rules reach the model **inside the node's input JSON**, not through a template field.
- `Edge(from_node=START, ...)` takes the **imported `START` object**, never the string `"START"`.
- A code node keeps the default `parameter_binding="state"`.
- All code comments and docstrings use **ASD-STE100 Simplified Technical English**.
