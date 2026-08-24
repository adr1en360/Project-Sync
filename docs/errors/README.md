# Error Screenshots and UI Containment Log

This document catalogs the execution error screenshots captured during live repository sync testing, explains the UI changes implemented to contain error presentation, and provides root-cause assessments and surgical fixes.

---

## 📸 Catalog of Saved Screenshots

| File | Title | Description | Status |
| :--- | :--- | :--- | :--- |
| [`01_run_github_404_repo_not_found.png`](file:///c:/Users/DELL/Documents/Project%20Sync/docs/errors/01_run_github_404_repo_not_found.png) | **Run Screen: GitHub 404 (Repo Not Found)** | Uncontained raw error JSON string displayed in the sidebar when attempting to scan `adr1en360/Project-Sync`. | ✅ Fixed via `<ErrorCallout>` + `humanizeError` |
| [`02_review_no_drafts_on_404.png`](file:///c:/Users/DELL/Documents/Project%20Sync/docs/errors/02_review_no_drafts_on_404.png) | **Review Desk: No Drafts on 404** | Empty draft state on the review desk after a failed 404 repository scan. | ✅ Handled with clean empty state & error banner |
| [`03_run_crucible_live_execution.png`](file:///c:/Users/DELL/Documents/Project%20Sync/docs/errors/03_run_crucible_live_execution.png) | **Run Screen: Live Graph Stepper on Crucible** | Live execution stepper actively running `extraction_agent` on `adr1en360/Crucible`. | ✅ Verified working live |
| [`04_review_crucible_drafts_generated.png`](file:///c:/Users/DELL/Documents/Project%20Sync/docs/errors/04_review_crucible_drafts_generated.png) | **Review Desk: Crucible Drafts Generated** | Successfully generated 4 career assets (portfolio card, doc sheet, bullets, social post) and active style rule `dont use slangs`. | ✅ Verified working live |
| [`05_review_github_403_token_permission_error.png`](file:///c:/Users/DELL/Documents/Project%20Sync/docs/errors/05_review_github_403_token_permission_error.png) | **Review Desk: GitHub 403 Permission Error on Commit** | `PARTLY COMMITTED` state with GitHub API 403 `Resource not accessible by personal access token` when attempting to push `docs/synced/crucible.md` and `cards/crucible.json`. | ✅ Contained via `<ErrorCallout>` with PAT fix guide |
| [`06_review_retry_button_no_loading_state.png`](file:///c:/Users/DELL/Documents/Project%20Sync/docs/errors/06_review_retry_button_no_loading_state.png) | **Review Desk: Retry Button Missing Active Loading Text** | The "Try the commits again" button receives `busy={review.busy}` which disables clicks, but lacked explicit dynamic loading text. | ✅ Fixed with `"Writing commits to GitHub..."` |

---

## 🛠️ Summary of UI Fixes Implemented

1. **Intake Primary Button (`Intake.tsx` & `ui.css`)**:
   * **Button Text**: Changed from awkward `"Scan repository"` / `"Read the repository"` to clean, professional **`"Sync Repository"`** (idle) and **`"Syncing repository..."`** (busy).
   * **No-Wrap Protection**: Added `white-space: nowrap;` to `.btn` in `ui.css` to prevent button text from ever wrapping onto two lines.
   * **Flexible Layout**: Wrapped form submit container with `flex-wrap: wrap` and `gap: var(--sp-4)` so help notes cleanly reflow beside or below the button.

2. **Compact Bullet Bank & Repository Grouping (`Library.tsx`, `group.ts`, `BulletGroup.tsx`)**:
   * Replaced verbose repeated pills with **repository grouping headers** (`byProject()`).
   * Added a one-click **"Copy all"** button (`CopyIcon` / `CheckIcon`) to copy an entire repository's achievements formatted for resumes/CVs.
   * Single-line compact layout with clean short dates and tag badges.

3. **Icon Buttons over Emojis & Word Labels (`icons.tsx`, `ui.css`)**:
   * Implemented crisp SVG icons (`CopyIcon`, `PenIcon`, `TrashIcon`, `RefreshIcon`, `CheckIcon`).
   * Row actions disclose on hover/focus (`.bank-acts`), maintaining full touch accessibility via `@media (hover: none)`.
   * Replaced unicode checkmarks in menus with `<CheckIcon />`.

4. **Error Containment & Message Humanization (`ErrorCallout.tsx`, `format.ts`)**:
   * Standardized `<ErrorCallout>` with `overflow-wrap: anywhere` and `word-break: break-word` across all screens to contain raw URLs and JSON dumps.
   * Smart parser `humanizeError()` converts cryptic GitHub 404/403 errors into actionable guidance.
   * Dynamic loading feedback for decision buttons (*"Publishing to GitHub..."*, *"Writing commits to GitHub..."*).

5. **Anti-AI Slop Copy Pass**:
   * Humanized all labels, instructions, empty states, and ledes across the application while strictly preserving the official submission tagline: **"Turn shipped code into career assets in one click"**.

---

## 🔍 Root-Cause Assessment & Solutions

### Issue 1: GitHub 404 (Repository Not Found)
* **Observed In**: Screenshots 01 & 02
* **Raw Message**: `GitHub gave 404 for /repos/adr1en360/Project-Sync: {"message":"Not Found", ...}`
* **Root Cause**: The repository `adr1en360/Project-Sync` does not exist under that exact slug or is private and inaccessible to the token.
* **Solution**: Use the exact public repository slug (e.g., `adr1en360/Crucible`).

### Issue 2: GitHub 403 (Resource Not Accessible by Personal Access Token)
* **Observed In**: Screenshots 05 & 06
* **Raw Message**: `Resource not accessible by personal access token: 403`
* **Root Cause**: The `GITHUB_TOKEN` in `.env` lacked `Contents: Read and write` permissions on the destination repository (`adr1en360/portfolio-data`).
* **Solution**:
  1. Generate a classic Personal Access Token with the **`repo`** scope, or
  2. For Fine-grained PATs, grant **`Contents: Read and write`** on the destination repository.
  3. Update `GITHUB_TOKEN` in `.env`.

### Issue 3: Button Text Wrapping & Label Polish
* **Observed In**: Intake screen
* **Root Cause**: Button lacked `white-space: nowrap` and used awkward phrasing.
* **Solution**: Set `.btn { white-space: nowrap; }` and updated label to `"Sync Repository"`.
