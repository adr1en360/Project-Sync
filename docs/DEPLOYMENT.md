# ProjectSync — Deployment Guide

ProjectSync is built for **Google Cloud Run** (stateless container execution) paired with **Cloud Firestore** (durable persistence).

---

## 1. Prerequisites

* **GCP Project** with billing enabled.
* **Google Cloud SDK (`gcloud`)** installed and authenticated:
  ```bash
  gcloud auth login
  gcloud config set project YOUR_PROJECT_ID
  ```
* **Required Google Cloud APIs**:
  ```bash
  gcloud services enable run.googleapis.com firestore.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
  ```

---

## 2. Environment Variables

Configure the following environment variables in `.env` or in Cloud Run Secret Manager:

| Variable | Description | Example |
|---|---|---|
| `GOOGLE_GENAI_USE_VERTEXAI` | Enable Vertex AI Gemini backend | `True` |
| `GOOGLE_CLOUD_PROJECT` | GCP Project ID | `projectsync-prod` |
| `GOOGLE_CLOUD_LOCATION` | Region for Vertex AI calls | `us-central1` |
| `MODEL_ID` | Pinned Gemini model | `gemini-3.7-flash` |
| `GITHUB_TOKEN` | GitHub Personal Access Token (`repo` scope) | `ghp_...` |
| `PORTFOLIO_DATA_REPO` | Target private repo for portfolio cards | `owner/portfolio-data` |
| `FIRESTORE_TRANSACTIONS` | Collection name for runs | `projectsync_transactions` |
| `FIRESTORE_STYLE_RULES` | Collection name for style rules | `projectsync_style_rules` |
| `FIRESTORE_RESUME_BULLETS` | Collection name for bullet bank | `projectsync_resume_bullets` |

---

## 3. Local Development & Testing

```bash
# 1. Install dependencies
uv sync

# 2. Build the React web frontend
cd web
npm install
npm run build
cd ..

# 3. Start the FastAPI server
uv run uvicorn main:app --port 8080 --reload
```

Open `http://127.0.0.1:8080` in your browser.

---

## 4. Google Cloud Run Live Deployment

```bash
# Build and deploy container directly from source
gcloud run deploy projectsync \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_GENAI_USE_VERTEXAI=True,MODEL_ID=gemini-3.7-flash,GOOGLE_CLOUD_LOCATION=us-central1 \
  --set-secrets GITHUB_TOKEN=GITHUB_TOKEN:latest
```
