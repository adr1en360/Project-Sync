/*
  The ledger of the six graph nodes.

  A graph workflow does not support live streaming, and the transaction row
  carries no log for each node. So this module reads the fields of the row and
  says which nodes reported. The ledger is evidence, and not a progress bar.
*/

import { el } from "./dom.js";

const NODE_ORDER = ["scan", "extract", "rules", "generate", "evaluate", "persist"];

/* Each failed status tells which node stopped the run. */
const FAILED_AT = {
  FAILED_SCAN: "scan",
  FAILED_EXTRACTION: "extract",
  FAILED_GENERATION: "generate",
};

/**
 * Read the row and say which nodes reported.
 * A line is marked only when its output is in the row.
 */
function ledgerStates(tx) {
  if (!tx) return {};

  const done = {
    scan: Boolean(tx.metadata),
    extract: Boolean(tx.metadata),
    rules: Boolean(tx.assets),
    generate: Boolean(tx.assets),
    evaluate: Boolean(tx.recommendation),
    persist: tx.status !== "RUNNING" && !String(tx.status).startsWith("FAILED"),
  };

  const failedNode = FAILED_AT[tx.status] || null;
  const result = {};
  let activeTaken = false;

  for (const node of NODE_ORDER) {
    if (failedNode) {
      const stopped = NODE_ORDER.indexOf(failedNode);
      const here = NODE_ORDER.indexOf(node);
      result[node] = here < stopped ? "done" : here === stopped ? "failed" : "idle";
      continue;
    }
    if (done[node]) {
      result[node] = "done";
    } else if (!activeTaken && tx.status === "RUNNING") {
      result[node] = "active";
      activeTaken = true;
    } else {
      result[node] = "idle";
    }
  }
  return result;
}

/** Put the state of each node on its line. */
export function renderLedger(tx) {
  const states = ledgerStates(tx);
  for (const line of el.ledger.querySelectorAll("li")) {
    line.dataset.state = states[line.dataset.node] || "idle";
  }
}

/** Make every line idle again. A new record starts with a clean ledger. */
export function resetLedger() {
  for (const line of el.ledger.querySelectorAll("li")) line.dataset.state = "idle";
}
