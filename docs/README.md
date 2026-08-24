# ProjectSync Documentation

> **Turn shipped code into career assets in one click.**

ProjectSync is an autonomous Taskmaster AI Agent built for the Google / Devpost **All Things Agentic Hackathon**. It ingests finished GitHub repositories, extracts technical architecture, generates multi-format career assets (documentation, resume bullets, portfolio cards, and social announcements), and continually adapts to the developer's voice through an adaptive style memory curator.

---

## 🏛️ Architecture Overview

<p align="center">
  <img src="architecture_diagram.svg" alt="ProjectSync Architecture Diagram" width="100%">
</p>

---

## 📚 Documentation Index

1. **[How the Agent Works (`AGENT_WORKFLOW.md`)](AGENT_WORKFLOW.md)**:
   * 7-Node Directed Acyclic Graph (DAG) specification in Google ADK 2.0.
   * State and data flow contracts with Pydantic v2 validation.
   * Dual-layer memory architecture (Semantic Style Rules + Episodic Transaction Ledger).
   * The Adaptive Curator Agent and human-in-the-loop safeguards.

2. **[Backend API Reference (`API_REFERENCE.md`)](API_REFERENCE.md)**:
   * Phase 1 Ingestion & Live Pipeline Execution (`POST /api/v1/trigger-sync`, `GET /events`).
   * Cooperative Cancellation & Resumption (`POST /cancel`, `POST /resume`).
   * Phase 2 Human Approval, Asset Regeneration & Dual-Commit (`POST /approval-callback`).
   * Resume Bullet Bank CRUD (`/api/v1/bullets`).
   * Style Rule Semantic Memory CRUD (`/api/v1/rules`).
   * Multi-Platform Social Drafts Management (`/api/v1/social-drafts`).

3. **[Deployment & Cloud Run Guide (`DEPLOYMENT.md`)](DEPLOYMENT.md)**:
   * Google Cloud Run stateless container deployment.
   * Google Cloud Firestore setup and security rules.
   * Environment variable configuration and secret management.

4. **[Devpost Submission (`devpost_submission.md`)](devpost_submission.md)**:
   * Official hackathon submission narrative, architecture summary, and track requirements.

---

## 🧪 Testing Instructions (For Judges)

### 1. Instant Offline Verification (No API Keys Needed)
Run our comprehensive unit and integration test suites:

```bash
# Run backend test suite (66 offline tests)
uv run pytest tests/ -q

# Run frontend test suite (68 component & store tests)
cd web && npm test -- --run && cd ..
```

### 2. Run the Local Web Application
```bash
# 1. Install dependencies
uv sync

# 2. Build the React web frontend
cd web && npm run build && cd ..

# 3. Start the FastAPI server
uv run uvicorn main:app --port 8080 --reload
```
Open [http://localhost:8080](http://localhost:8080) to interact with the Review Desk and visual agent pipeline.

### 3. Live Model & Adaptive Memory Test (Optional)
With a `GOOGLE_API_KEY` configured in `.env`:
```bash
RUN_LIVE_TESTS=1 uv run pytest tests/test_style_rules_change_output.py -v
```
