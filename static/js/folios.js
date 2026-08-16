/*
  The four folios: the boxes that hold the drafts, and the meter below each one.

  Each box is a textarea, so the operator edits the draft in place. The edits go
  to the service with the approval, and nothing reaches GitHub before that.
*/

import { buttonLabel, el, folio, listItems, setButtonLabel } from "./dom.js";
import { slip } from "./slips.js";
import { state } from "./state.js";

const POST_LIMIT = 280; // the character limit of one social post

/*
  The keys of `PortfolioCard` in `models.py`.

  The card is a typed model on the service, because the Gemini Developer API
  refuses a schema with `additionalProperties`. A typed model also drops a key
  that is not in the list. The operator must read that before the approval, and
  not find the key absent after it. So the meter reports each unknown key.
*/
const CARD_KEYS = ["title", "tagline", "stack", "highlights", "repo_url"];

/* Some browsers size a textarea from its content. The rest need help. */
const NATIVE_SIZING =
  typeof CSS !== "undefined" && CSS.supports && CSS.supports("field-sizing", "content");

/* ---------------------------------------------------------------- */
/* Write                                                            */
/* ---------------------------------------------------------------- */

/** Put the four drafts in the four boxes. `fresh` marks a new draft. */
export function renderFolios(tx, fresh = false) {
  if (!tx.assets) {
    el.folios.hidden = true;
    return;
  }
  el.folios.hidden = false;
  const assets = tx.assets;

  setBox(folio.doc.box, assets.doc_sheet_md || "", fresh);
  setBox(folio.card.box, JSON.stringify(assets.portfolio_card || {}, null, 2), fresh);
  setBox(folio.bullets.box, (assets.resume_bullets || []).join("\n"), fresh);
  setBox(folio.social.box, assets.social_draft || "", fresh);
  measureAll();

  // The rules that made this draft, in the margin of the fourth folio.
  listItems(el.appliedRules, (tx.style_rules_applied || []).map(shortRuleLabel));
}

/** Give a short label for one rule id. The text comes from the rules panel. */
function shortRuleLabel(ruleId) {
  const known = state.rules.find((rule) => rule.rule_id === ruleId);
  if (!known) return ruleId.slice(0, 8);
  return known.text.length > 46 ? `${known.text.slice(0, 44)}…` : known.text;
}

function setBox(box, value, fresh) {
  box.value = value;
  autosize(box);
  if (fresh) {
    box.dataset.fresh = "yes";
    setTimeout(() => box.removeAttribute("data-fresh"), 1200);
  }
}

function autosize(box) {
  if (NATIVE_SIZING) return;
  box.style.height = "auto";
  box.style.height = `${Math.min(box.scrollHeight + 4, 540)}px`;
}

/* ---------------------------------------------------------------- */
/* The meters                                                       */
/* ---------------------------------------------------------------- */

/** Measure the four boxes and write the four meters. */
function measureAll() {
  const words = folio.doc.box.value.trim().split(/\s+/).filter(Boolean).length;
  folio.doc.meter.textContent = `${words} words · markdown`;
  folio.doc.meter.dataset.warn = folio.doc.box.value.trim() ? "no" : "yes";

  const card = readCard();
  folio.card.meter.textContent = cardMeterText(card);
  folio.card.meter.dataset.warn = card.ok && !card.unknown.length ? "no" : "yes";

  const bullets = readBullets();
  folio.bullets.meter.textContent = `${bullets.length} ${bullets.length === 1 ? "line" : "lines"}`;
  folio.bullets.meter.dataset.warn = bullets.length ? "no" : "yes";

  const chars = folio.social.box.value.length;
  folio.social.meter.textContent = `${chars} characters · ${POST_LIMIT} is one post`;
  folio.social.meter.dataset.warn = chars > POST_LIMIT ? "yes" : "no";
}

/** Give the words for the meter below the card. */
function cardMeterText(card) {
  if (!card.ok) return `not valid JSON — ${card.error}`;
  if (card.unknown.length) {
    const names = card.unknown.join(", ");
    const one = card.unknown.length === 1;
    return `valid JSON, but the approval drops ${one ? "this key" : "these keys"}: ${names}`;
  }
  return `valid JSON · ${Object.keys(card.value).length} keys`;
}

/* ---------------------------------------------------------------- */
/* Read                                                             */
/* ---------------------------------------------------------------- */

/**
 * Parse the card box.
 * The result holds `unknown`, which lists each key that the service does not
 * keep. An unknown key is not an error, so `ok` stays true for it.
 */
function readCard() {
  const raw = folio.card.box.value.trim();
  if (!raw) return { ok: true, value: {}, unknown: [] };
  try {
    const value = JSON.parse(raw);
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, error: "the card must be a JSON object", unknown: [] };
    }
    const unknown = Object.keys(value).filter((key) => !CARD_KEYS.includes(key));
    return { ok: true, value, unknown };
  } catch (error) {
    return { ok: false, error: error.message, unknown: [] };
  }
}

/** Give one bullet for each line. A leading dash or dot goes away. */
const readBullets = () =>
  folio.bullets.box.value
    .split("\n")
    .map((line) => line.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(Boolean);

/**
 * Read the four folios into the shape of `GeneratedAssets`.
 * The function gives null when the card does not parse. A bad card must never
 * go to the service, because the service would refuse the whole approval.
 */
export function collectEdits() {
  const card = readCard();
  if (!card.ok) {
    slip("Folio II", `The portfolio card is not valid JSON. ${card.error}`, "bad");
    folio.card.box.focus();
    return null;
  }
  return {
    doc_sheet_md: folio.doc.box.value,
    portfolio_card: card.value,
    resume_bullets: readBullets(),
    social_draft: folio.social.box.value,
  };
}

/* ---------------------------------------------------------------- */
/* The listeners                                                    */
/* ---------------------------------------------------------------- */

/** Make the boxes grow, the meters follow a keystroke, and the copy buttons work. */
export function connectFolios() {
  for (const part of Object.values(folio)) {
    part.box.addEventListener("input", () => {
      autosize(part.box);
      measureAll();
    });
  }

  // One listener for each copy button is not necessary. The buttons are in the
  // markup, and each one names its box in `data-copy`.
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-copy]");
    if (!button) return;
    const box = document.getElementById(button.dataset.copy);
    try {
      await navigator.clipboard.writeText(box.value);
      const label = buttonLabel(button);
      setButtonLabel(button, "Copied");
      setTimeout(() => setButtonLabel(button, label), 1400);
    } catch {
      box.select();
      slip("Copy", "The browser refused the clipboard. The text is selected.", "warn");
    }
  });
}
