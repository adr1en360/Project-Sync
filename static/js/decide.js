/*
  The three decisions on an open record: write again, discard, approve.

  Only the approval writes to GitHub. The other two write nothing there.
*/

import { postJson } from "./api.js";
import { buttonLabel, el, setButtonLabel } from "./dom.js";
import { collectEdits, renderFolios } from "./folios.js";
import { pollOnce } from "./poll.js";
import { loadRules } from "./rules.js";
import { slip } from "./slips.js";
import { state } from "./state.js";

/** Ask the service for a new draft that obeys the rules that are on now. */
async function writeAgain() {
  if (!state.tx) return;
  el.regenerate.disabled = true;
  const label = buttonLabel(el.regenerate);
  setButtonLabel(el.regenerate, "Writing…");
  try {
    const answer = await postJson("/api/v1/regenerate-asset", {
      transaction_id: state.tx.tx_id,
    });
    state.tx.assets = answer.assets;
    state.tx.style_rules_applied = (state.rules || [])
      .filter((rule) => rule.state === "ACTIVE")
      .map((rule) => rule.rule_id);
    renderFolios(state.tx, true);
    const count = (answer.style_rules_applied || []).length;
    slip(
      "Written again",
      count
        ? `${count} active ${count === 1 ? "rule" : "rules"} shaped this draft.`
        : "No rule is active, so this draft had none to obey.",
      count ? "ok" : "warn",
    );
  } catch (error) {
    slip("Write again failed", error.message, "bad");
  } finally {
    el.regenerate.disabled = false;
    setButtonLabel(el.regenerate, label);
  }
}

/** Approve the four drafts, with the edits of the operator, and commit. */
async function approve() {
  if (!state.tx) return;
  const edits = collectEdits();
  if (edits === null) return;

  // Ask first. This action writes two commits to two repositories, and a commit
  // is not easy to take back. The discard action asks, so the action that writes
  // must ask too.
  const target = state.tx.repo_name;
  const question =
    `Commit for ${target}?\n\n` +
    "· The documentation sheet goes to docs/synced/ in that repository.\n" +
    "· The portfolio card goes to your private portfolio repository.\n\n" +
    "Both are real commits. The resume lines and the social post stay here.";
  if (!confirm(question)) return;

  el.approve.disabled = true;
  const approveLabel = buttonLabel(el.approve);
  setButtonLabel(el.approve, "Committing…");
  try {
    const answer = await postJson("/api/v1/approval-callback", {
      transaction_id: state.tx.tx_id,
      approved: true,
      edited_assets: edits,
    });

    if (answer.status === "COMPLETED") {
      slip("Both commits landed", "The loop is closed. The receipts are on the sheet.", "ok");
    } else {
      slip(
        "One commit failed",
        answer.doc_error || answer.card_error || "The row is PARTIAL. Approve again to retry.",
        "warn",
      );
    }
    for (const rule of answer.proposed_rules || []) {
      slip("The curator proposes a rule", rule, "ok");
    }
    await loadRules(state.tx.user_id);
    await pollOnce(state.tx.tx_id);
  } catch (error) {
    slip("The approval failed", error.message, "bad");
  } finally {
    el.approve.disabled = false;
    setButtonLabel(el.approve, approveLabel);
  }
}

/** Close the record with no commit. */
async function discard() {
  if (!state.tx) return;
  const name = (state.tx.metadata && state.tx.metadata.project_name) || state.tx.repo_name;
  if (!confirm(`Discard the four drafts for ${name}? Nothing commits, and the row closes as rejected.`)) {
    return;
  }
  el.discard.disabled = true;
  try {
    await postJson("/api/v1/approval-callback", {
      transaction_id: state.tx.tx_id,
      approved: false,
    });
    slip("Discarded", "The row is rejected. No commit was written.", "warn");
    await pollOnce(state.tx.tx_id);
  } catch (error) {
    slip("The discard failed", error.message, "bad");
  } finally {
    el.discard.disabled = false;
  }
}

/** Listen for the three buttons at the foot of the sheet. */
export function connectDecisions() {
  el.regenerate.addEventListener("click", writeAgain);
  el.approve.addEventListener("click", approve);
  el.discard.addEventListener("click", discard);
}
