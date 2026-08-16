/*
  The intake form. It starts a run and opens the record that comes back.
*/

import { postJson } from "./api.js";
import { el } from "./dom.js";
import { openRecord } from "./poll.js";
import { loadRules } from "./rules.js";
import { SAVED_USER } from "./state.js";

/*
  The service tests the URL again with the same rule. This test is here to give
  the operator an answer with no request, and it is not the guard.
*/
const GITHUB_URL = /^https?:\/\/(www\.)?github\.com\/[^/\s]+\/[^/\s]+/;

/** Listen for the intake form. */
export function connectIntake() {
  el.intake.addEventListener("submit", async (event) => {
    event.preventDefault();
    el.intakeError.hidden = true;

    const repoUrl = el.repoUrl.value.trim();
    if (!GITHUB_URL.test(repoUrl)) {
      el.intakeError.hidden = false;
      el.intakeError.textContent =
        "Give a GitHub repository URL, in the form https://github.com/owner/name.";
      el.repoUrl.focus();
      return;
    }

    const userId = el.userId.value.trim() || "default";
    localStorage.setItem(SAVED_USER, userId);

    const payload = { repo_url: repoUrl, user_id: userId };
    const commit = el.commitSha.value.trim();
    if (commit) payload.commit_sha = commit;

    el.begin.disabled = true;
    el.begin.querySelector("span").textContent = "Opening…";
    try {
      const answer = await postJson("/api/v1/trigger-sync", payload);
      openRecord(answer.transaction_id);
      await loadRules(userId);
    } catch (error) {
      el.intakeError.hidden = false;
      el.intakeError.textContent = error.message;
    } finally {
      el.begin.disabled = false;
      el.begin.querySelector("span").textContent = "Open a record";
    }
  });
}
