/*
  The sheet: one transaction as a document.

  This module writes the head, the gate, and the receipts. It calls the folios
  module and the stamp module for the parts that they own.
*/

import { el, fact, listItems } from "./dom.js";
import { renderFolios } from "./folios.js";
import { renderStamp } from "./stamp.js";

/*
  The service writes every time in UTC, because `store.now_iso()` uses the UTC
  zone. Do not cut the letters off the ISO text and show what is left. That gives
  a UTC time with no zone on it, and a person in a different zone then reads a
  time that is hours away from the true one.

  `Intl.DateTimeFormat` moves the value into the zone of the browser and writes
  the name of that zone. The first argument is `undefined`, so the format follows
  the language of the person and not a fixed one.
*/
const STAMP_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
  timeZoneName: "short",
});

/** Change an ISO time from the service into text for this browser. */
function when(iso) {
  if (!iso) return "—";
  const at = new Date(iso);
  // A bad value must show as it is. It must not show as "Invalid Date".
  return Number.isNaN(at.getTime()) ? iso : STAMP_FORMAT.format(at);
}

/** Write the whole sheet from one transaction row. */
export function renderSheet(tx) {
  el.txid.textContent = tx.tx_id;
  el.proj.textContent = (tx.metadata && tx.metadata.project_name) || tx.repo_name;
  el.tagline.textContent =
    (tx.metadata && tx.metadata.tagline) ||
    "The extraction has not reported yet. The ledger shows how far the run went.";

  el.facts.replaceChildren(
    fact("Repository", tx.repo_name, tx.repo_url),
    fact("Status", String(tx.status).replace(/_/g, " ").toLowerCase()),
    fact("Operator", tx.user_id),
    fact("Opened", when(tx.created_at)),
  );
  if (tx.metadata && tx.metadata.tech_stack && tx.metadata.tech_stack.length) {
    el.facts.append(fact("Stack", tx.metadata.tech_stack.join(" · ")));
  }
  if (tx.error_message) {
    el.facts.append(fact("Error", tx.error_message));
  }

  renderVerdict(tx);
  renderFolios(tx);
  renderStamp(tx);
  renderActions(tx);
}

/** Write the decision of the path evaluator, with the reasons for it. */
function renderVerdict(tx) {
  if (!tx.recommendation) {
    el.verdict.hidden = true;
    return;
  }
  const rec = tx.recommendation;
  el.verdict.hidden = false;
  el.verdictLine.dataset.verdict = rec.recommendation;

  const confidence = Math.round((rec.confidence || 0) * 100);
  el.verdictLine.replaceChildren();
  const verb = document.createElement("b");
  verb.textContent = rec.recommendation === "FULL_PUBLISH" ? "Ready to show" : "Hold it back";
  const tail = document.createElement("span");
  tail.textContent = ` — ${rec.recommendation.replace(/_/g, " ").toLowerCase()}, at ${confidence}% confidence.`;
  el.verdictLine.append(verb, tail);

  listItems(el.verdictReasons, rec.reasons);
  listItems(el.verdictMissing, rec.missing_elements);
}

/** Turn the three buttons on or off, and say why. */
function renderActions(tx) {
  const open = tx.status === "PENDING_APPROVAL" && Boolean(tx.assets);
  const partial = tx.status === "PARTIAL";
  el.act.hidden = !tx.assets;

  el.approve.disabled = !open && !partial;
  el.discard.disabled = !open;
  el.regenerate.disabled = !open;

  if (open) {
    el.actNote.textContent =
      "Read the four folios. Edit any of them. The edits go with the approval, " +
      "and nothing reaches GitHub before you press approve.";
  } else if (partial) {
    el.actNote.textContent =
      "One commit landed and one failed. Press approve again to retry the part " +
      "that failed. The part that succeeded is not written twice.";
  } else {
    el.actNote.textContent = `This record is ${String(tx.status).replace(/_/g, " ").toLowerCase()}. The folios are read only.`;
  }

  renderReceipts(tx);
}

/** Show the commit for each side, with a link to the one that has a URL. */
function renderReceipts(tx) {
  if (!tx.doc_commit_sha && !tx.card_commit_sha) {
    el.receipts.hidden = true;
    return;
  }
  el.receipts.hidden = false;
  el.receipts.dataset.partial = tx.status === "PARTIAL" ? "yes" : "no";
  el.receipts.replaceChildren();

  if (tx.doc_commit_sha) {
    el.receipts.append(
      fact(
        "Doc sheet commit",
        tx.doc_commit_sha.slice(0, 12),
        `${tx.repo_url.replace(/\/$/, "")}/commit/${tx.doc_commit_sha}`,
      ),
    );
  }
  // The portfolio repository is private, so a link to that commit helps nobody.
  if (tx.card_commit_sha) {
    el.receipts.append(fact("Portfolio card commit", tx.card_commit_sha.slice(0, 12)));
  }
  if (tx.completed_at) {
    el.receipts.append(fact("Closed", when(tx.completed_at)));
  }
}
