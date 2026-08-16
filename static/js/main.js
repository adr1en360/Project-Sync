/*
  ProjectSync — the review desk.

  This file is the map of the page. It connects each listener and then reads the
  first values from the service. No other module runs code at import, so the
  order of the work below is the order that you read.

  The page has no framework and no build step. The browser reads these modules
  itself, because the script tag has `type="module"`. So the container needs no
  Node.

  The modules:
    api.js      the one door to the service
    state.js    the values that more than one module reads
    dom.js      every id of the page, and two builders
    slips.js    the notes at the corner of the desk
    health.js   the masthead
    ledger.js   the six graph nodes
    stamp.js    the rubber stamp
    folios.js   the four editable drafts
    sheet.js    one transaction as a document
    poll.js     the poll that follows a run
    intake.js   the form that starts a run
    decide.js   write again, discard, approve
    rules.js    the voice rules
*/

import { api } from "./api.js";
import { connectDecisions } from "./decide.js";
import { el } from "./dom.js";
import { connectFolios } from "./folios.js";
import { loadHealth } from "./health.js";
import { connectIntake } from "./intake.js";
import { renderLedger } from "./ledger.js";
import { openRecord } from "./poll.js";
import { connectRules, loadRules } from "./rules.js";
import { renderSheet } from "./sheet.js";
import { SAVED_TX, SAVED_USER, state } from "./state.js";

connectIntake();
connectDecisions();
connectFolios();
connectRules();

async function boot() {
  const savedUser = localStorage.getItem(SAVED_USER);
  if (savedUser) el.userId.value = savedUser;

  await loadHealth();
  await loadRules(el.userId.value.trim() || "default");

  // A reload must not lose the record that is open.
  const savedTx = localStorage.getItem(SAVED_TX);
  if (savedTx) {
    el.poll.textContent = "Reading the record that was open.";
    try {
      const tx = await api(`/api/v1/transactions/${encodeURIComponent(savedTx)}`);
      state.tx = tx;
      renderLedger(tx);
      renderSheet(tx);
      if (tx.status === "RUNNING") {
        openRecord(savedTx);
      } else {
        el.poll.textContent = `The last record stopped at ${String(tx.status).replace(/_/g, " ")}.`;
      }
    } catch {
      localStorage.removeItem(SAVED_TX);
      el.poll.textContent = "No record open.";
    }
  }
}

boot();
