/*
  The rubber stamp on the sheet.

  The stamp is the point of the product. A gate that can say no must look like
  one. The element is decoration for a screen reader, because the verdict
  section gives the same words as text.
*/

import { el } from "./dom.js";
import { state } from "./state.js";

const STAMP_TEXT = {
  FULL_PUBLISH: ["Full publish", "gate · passed"],
  PRIVATE_ONLY: ["Private only", "gate · held"],
  PENDING_APPROVAL: ["Awaiting you", "no commit yet"],
  COMPLETED: ["Committed", "closed loop"],
  PARTIAL: ["Part committed", "one side failed"],
  REJECTED: ["Discarded", "by the operator"],
  FAILED_SCAN: ["Scan failed", "step one"],
  FAILED_EXTRACTION: ["Extract failed", "step two"],
  FAILED_GENERATION: ["Write failed", "step four"],
};

/**
 * Put the verdict on the paper.
 * The stamp lands one time for each verdict. A poll that finds the same
 * verdict again does not make it land again.
 */
export function renderStamp(tx) {
  if (!tx) {
    el.stamp.dataset.verdict = "";
    el.stamp.removeAttribute("data-land");
    state.stamped = "";
    return;
  }

  // The gate reads before the row status, because the gate is the decision.
  let key = tx.status;
  if (tx.status === "PENDING_APPROVAL" && tx.recommendation) {
    key = tx.recommendation.recommendation;
  }

  const [text, sub] = STAMP_TEXT[key] || [String(key).replace(/_/g, " "), "row status"];
  el.stamp.querySelector(".stamp__text").textContent = text;
  el.stamp.querySelector(".stamp__sub").textContent = sub;
  el.stamp.dataset.verdict = key;

  if (state.stamped !== key) {
    el.stamp.removeAttribute("data-land");
    void el.stamp.offsetWidth; // restart the animation
    el.stamp.dataset.land = "yes";
    state.stamped = key;
  }
}
