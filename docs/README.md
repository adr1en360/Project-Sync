# ProjectSync Documentation

> **Turn shipped code into career assets in one click.**

ProjectSync is an autonomous Taskmaster AI Agent built for the Google / Devpost **All Things Agentic Hackathon**. It ingests finished GitHub repositories, extracts technical architecture, generates multi-format career assets (documentation, resume bullets, portfolio cards, and social announcements), and continually adapts to the developer's voice through an adaptive style memory curator.

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

## ⚡ Quickstart

```bash
# 1. Install dependencies
uv sync

# 2. Build the React web frontend
cd web && npm run build && cd ..

# 3. Run the development server
uv run uvicorn main:app --port 8080 --reload
```
