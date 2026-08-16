/*
  The poll.

  A graph workflow does not support live streaming, so the page asks the service
  for the transaction row again and again. It holds no connection open.
*/

import { api } from "./api.js";
import { el } from "./dom.js";
import { renderLedger, resetLedger } from "./ledger.js";
import { renderSheet } from "./sheet.js";
import { slip } from "./slips.js";
import { SAVED_TX, state } from "./state.js";
import { showTab, syncTabs } from "./tabs.js";

const POLL_MS = 1600;
const POLL_LIMIT = 150; // about four minutes

/** Stop the poll that waits. The page then makes no more requests. */
function stopPolling() {
  if (state.timer) clearTimeout(state.timer);
  state.timer = null;
}

/**
 * Read the row one time and write the page from it.
 * The function starts the next poll itself while the row is RUNNING. So one call
 * is enough to follow a run to the end of it.
 */
export async function pollOnce(txId) {
  state.polls += 1;
  let tx;
  try {
    tx = await api(`/api/v1/transactions/${encodeURIComponent(txId)}`);
  } catch (error) {
    el.poll.textContent = `The poll failed. ${error.message}`;
    stopPolling();
    slip("Poll", error.message, "bad");
    return;
  }

  state.tx = tx;
  renderLedger(tx);
  renderSheet(tx);
  syncTabs(tx);

  if (tx.status === "RUNNING") {
    if (state.polls >= POLL_LIMIT) {
      el.poll.textContent =
        `The row is still RUNNING after ${state.polls} checks. The poll stopped. ` +
        "Reload the page to look again.";
      stopPolling();
      return;
    }
    el.poll.textContent = `Running · ${state.polls} ${state.polls === 1 ? "check" : "checks"} · the first unmarked line is where the run is, or just before it.`;
    state.timer = setTimeout(() => pollOnce(txId), POLL_MS);
    return;
  }

  stopPolling();
  el.poll.textContent = `The run stopped at ${String(tx.status).replace(/_/g, " ")} after ${state.polls} ${state.polls === 1 ? "check" : "checks"}.`;

  if (tx.status === "PENDING_APPROVAL") {
    // The run is complete and the gate waits for a person. So the page opens the
    // tab that holds the drafts and the verdict.
    showTab("review");
  }
  if (String(tx.status).startsWith("FAILED")) {
    slip("The run failed", tx.error_message || String(tx.status), "bad");
  }
}

/** Open one record on the sheet and follow it to the end of the run. */
export function openRecord(txId) {
  stopPolling();
  state.polls = 0;
  state.stamped = "";
  resetLedger();
  localStorage.setItem(SAVED_TX, txId);
  el.txid.textContent = txId;
  el.poll.textContent = "Opened. The first check follows.";
  // A run starts now, so the page shows the tab that reports the nodes.
  showTab("run");
  pollOnce(txId);
}
