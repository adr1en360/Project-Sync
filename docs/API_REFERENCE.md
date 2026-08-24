# ProjectSync — Backend API Reference

Base URL: `http://127.0.0.1:8080` (Local) / `https://<service-name>.run.app` (Cloud Run)  
API Version: `v1` (`/api/v1`)

---

## 1. Phase 1: Repository Sync & Pipeline Execution

### `POST /api/v1/trigger-sync`
Starts the 7-node ADK 2.0 pipeline in the background for a GitHub repository.

* **Request Body** (`application/json`):
  ```json
  {
    "repo_url": "https://github.com/owner/repository",
    "user_id": "default",
    "commit_sha": null
  }
  ```
* **Response** (`200 OK`):
  ```json
  {
    "transaction_id": "ec55960ed35947cd8cad1ea51bf66cad",
    "status": "RUNNING",
    "repo_name": "owner/repository",
    "created_at": "2026-08-24T19:40:00.000000Z"
  }
  ```

---

### `GET /api/v1/transactions`
Lists transactions for a user, sorted newest first.

* **Query Parameters**:
  * `user_id` (string, default: `"default"`)
  * `status` (string, optional: `RUNNING`, `PENDING_APPROVAL`, `COMPLETED`, `PARTIAL`, `FAILED_SCAN`, `FAILED_EXTRACTION`, `FAILED_GENERATION`, `CANCELLED`)
  * `limit` (int, default: `20`)
* **Response** (`200 OK`): Array of Transaction objects.

---

### `GET /api/v1/transactions/{tx_id}/events`
Returns real-time execution events for all 7 nodes of a transaction.

* **Response** (`200 OK`):
  ```json
  [
    {
      "event_id": "a1b2c3d4",
      "tx_id": "ec55960ed35947cd8cad1ea51bf66cad",
      "node": "scan_github_repository",
      "state": "COMPLETED",
      "started_at": "2026-08-24T19:40:00.100000Z",
      "finished_at": "2026-08-24T19:40:02.400000Z",
      "error": null
    },
    {
      "event_id": "e5f6g7h8",
      "tx_id": "ec55960ed35947cd8cad1ea51bf66cad",
      "node": "extraction_agent",
      "state": "COMPLETED",
      "started_at": "2026-08-24T19:40:02.500000Z",
      "finished_at": "2026-08-24T19:40:22.100000Z",
      "error": null
    }
  ]
  ```

---

### `POST /api/v1/transactions/{tx_id}/cancel`
Requests cooperative cancellation of an active `RUNNING` transaction.

* **Response** (`200 OK`):
  ```json
  {
    "status": "cancel_requested",
    "transaction_id": "ec55960ed35947cd8cad1ea51bf66cad"
  }
  ```

---

### `POST /api/v1/transactions/{tx_id}/resume`
Resumes Phase 1 execution for stopped/failed runs under the same transaction ID.

* **Permitted States**: `CANCELLED`, `FAILED_SCAN`, `FAILED_EXTRACTION`, `FAILED_GENERATION`
* **Response** (`200 OK`):
  ```json
  {
    "status": "resumed",
    "transaction_id": "ec55960ed35947cd8cad1ea51bf66cad"
  }
  ```

---

## 2. Phase 2: Review, Edit & Dual-Commit Approval

### `POST /api/v1/approval-callback`
Submits human approval for generated assets, commits assets to GitHub, seeds the Bullet Bank, and triggers the Curator learning loop.

* **Request Body** (`application/json`):
  ```json
  {
    "transaction_id": "ec55960ed35947cd8cad1ea51bf66cad",
    "approval_token": "token_uuid",
    "edited_assets": {
      "doc_sheet_md": "# Updated Documentation...",
      "portfolio_card": {
        "title": "Project Title",
        "tagline": "One line summary",
        "tags": ["FastAPI", "Gemini", "React"],
        "bullets": ["Bullet 1", "Bullet 2", "Bullet 3"],
        "repo_url": "https://github.com/owner/repository"
      },
      "resume_bullets": ["Bullet 1", "Bullet 2", "Bullet 3"],
      "social_draft": "Post text..."
    },
    "publish_docs": true,
    "publish_portfolio": true
  }
  ```
* **Response** (`200 OK`):
  ```json
  {
    "status": "COMPLETED",
    "doc_sheet_committed": true,
    "portfolio_card_committed": true,
    "bullets_seeded": 3,
    "proposed_rules": ["Do not use slang in documentation"]
  }
  ```

---

### `POST /api/v1/regenerate-asset`
Regenerates a single asset format on the Review desk using Gemini 3.7 Flash without re-running the entire pipeline.

* **Request Body** (`application/json`):
  ```json
  {
    "transaction_id": "ec55960ed35947cd8cad1ea51bf66cad",
    "asset_type": "social_draft",
    "custom_instruction": "Make it more technical for engineers"
  }
  ```
* **Response** (`200 OK`):
  ```json
  {
    "asset_type": "social_draft",
    "content": "Updated social post content..."
  }
  ```

---

## 3. Resume Bullet Bank CRUD

* `GET /api/v1/bullets`: List saved resume bullets (supports `?project=...` and `?limit=...`).
* `POST /api/v1/bullets`: Manually create a new resume bullet.
* `GET /api/v1/bullets/{bullet_id}`: Retrieve a single bullet by ID.
* `PUT /api/v1/bullets/{bullet_id}`: Update bullet text, project name, or tags.
* `DELETE /api/v1/bullets/{bullet_id}`: Delete a bullet from the bank.

---

## 4. Semantic Memory: Style Rules CRUD

* `GET /api/v1/rules`: List all style rules for a user (`PROPOSED`, `ACTIVE`, `INACTIVE`).
* `POST /api/v1/rules`: Create a custom user-defined style rule.
* `PATCH /api/v1/rules/{rule_id}`: Update rule state (`ACTIVE` / `INACTIVE` / `PROPOSED`).
* `DELETE /api/v1/rules/{rule_id}`: Remove a style rule.

---

## 5. Social Drafts Management

* `GET /api/v1/social-drafts`: List drafts with optional platform filtering (`LINKEDIN`, `TWITTER_X`, `DEV_TO`).
* `POST /api/v1/social-drafts`: Save a new social post draft.
* `PUT /api/v1/social-drafts/{draft_id}`: Update draft content or target platform.
* `DELETE /api/v1/social-drafts/{draft_id}`: Delete a draft.
* `POST /api/v1/social-drafts/{draft_id}/publish`: Mark draft as published.
* `POST /api/v1/social-drafts/{draft_id}/schedule`: Set a scheduled publish timestamp.
