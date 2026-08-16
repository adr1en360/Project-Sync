/*
  The voice rules.

  A rule does nothing until the operator turns it on. That one click is the
  whole governance rule of the product. The generator reads the active rules new
  on each run, so a change here acts on the next draft.
*/

import { api, del, postJson } from "./api.js";
import { el } from "./dom.js";
import { renderFolios } from "./folios.js";
import { slip } from "./slips.js";
import { state } from "./state.js";

/* One click moves a rule to the other state. A proposal goes on. */
const NEXT_STATE = { PROPOSED: "ACTIVE", INACTIVE: "ACTIVE", ACTIVE: "INACTIVE" };
const TOGGLE_LABEL = { PROPOSED: "Turn on", INACTIVE: "Turn on", ACTIVE: "Turn off" };

/** Read the rules of one operator and write the panel. */
export async function loadRules(userId) {
  const owner = userId || el.userId.value.trim() || "default";
  try {
    state.rules = await api(`/api/v1/rules?user_id=${encodeURIComponent(owner)}`);
  } catch (error) {
    el.rules.replaceChildren();
    const li = document.createElement("li");
    li.className = "rules__empty";
    // The same element says "no rule yet" and "the rules did not load". The tone
    // tells the two apart, because an empty list is not a fault.
    li.dataset.tone = "bad";
    li.textContent = `The rules did not load. ${error.message}`;
    el.rules.append(li);
    return;
  }
  renderRules();
}

/** Write one line for each rule, with the button that changes the state. */
function renderRules() {
  el.rules.replaceChildren();

  if (!state.rules.length) {
    const li = document.createElement("li");
    li.className = "rules__empty";
    li.textContent =
      "No rule yet. Write one above, or approve two records and let the curator propose one.";
    el.rules.append(li);
    return;
  }

  // Active rules first, then the proposals that wait, then the rules that are off.
  const rank = { ACTIVE: 0, PROPOSED: 1, INACTIVE: 2 };
  const ordered = [...state.rules].sort(
    (a, b) => (rank[a.state] ?? 3) - (rank[b.state] ?? 3),
  );

  for (const rule of ordered) {
    const li = document.createElement("li");
    li.className = "rule";
    li.dataset.state = rule.state;

    const left = document.createElement("div");
    left.className = "rule__body";
    const text = document.createElement("p");
    text.className = "rule__text";
    text.textContent = rule.text;
    const meta = document.createElement("p");
    meta.className = "rule__meta";
    meta.textContent = `${rule.state} · ${rule.source === "CURATOR" ? "the curator" : "you"}`;
    left.append(text, meta);

    const button = document.createElement("button");
    button.className = "rule__toggle";
    button.type = "button";
    button.textContent = TOGGLE_LABEL[rule.state] || "Turn on";
    button.setAttribute("aria-pressed", String(rule.state === "ACTIVE"));
    button.addEventListener("click", () => setRuleState(rule));

    /*
      The delete button is the third child of the line, and the toggle stays the
      second child. The Node harness reads the children of a line by number, so
      an element that holds these two buttons together breaks three of its
      checks.

      The button carries an icon and no text, so the name comes from
      `aria-label`. The name repeats the rule, because a page can show many
      delete buttons and each one must say what it deletes.
    */
    const remove = document.createElement("button");
    remove.className = "rule__delete";
    remove.type = "button";
    remove.setAttribute("aria-label", `Delete the rule: ${rule.text}`);
    remove.setAttribute("title", "Delete this rule");
    remove.addEventListener("click", () => deleteRule(rule));

    li.append(left, button, remove);
    el.rules.append(li);
  }
}

/** Move one rule to the other state, on the service and then on the page. */
async function setRuleState(rule) {
  const next = NEXT_STATE[rule.state] || "ACTIVE";
  try {
    await postJson(`/api/v1/rules/${encodeURIComponent(rule.rule_id)}`, { state: next });
    rule.state = next;
    renderRules();
    // The margin of the fourth folio names the rules of the draft. A rule that
    // goes off must not stay in that margin.
    if (state.tx) renderFolios(state.tx);
    slip(
      next === "ACTIVE" ? "The rule is on" : "The rule is off",
      next === "ACTIVE"
        ? "The next draft obeys it. Press “write again” to use it on this record now."
        : "The rule stays in the database, so you can turn it on later.",
      next === "ACTIVE" ? "ok" : "warn",
    );
  } catch (error) {
    slip("The rule did not change", error.message, "bad");
  }
}

/**
 * Delete one rule, and offer an undo.
 *
 * The delete is soft. The service puts the state of the rule to DELETED and
 * keeps the document, so the receipts of a draft that named this rule stay
 * correct and the voice corpus keeps the sentence.
 *
 * The page offers an undo and asks no question first. A question before each
 * delete costs the operator a click every time. An undo costs a click only when
 * the delete was a mistake, and the soft delete makes the undo exact.
 */
async function deleteRule(rule) {
  const previous = rule.state;
  try {
    await del(`/api/v1/rules/${encodeURIComponent(rule.rule_id)}`);
  } catch (error) {
    slip("The rule was not deleted", error.message, "bad");
    return;
  }

  state.rules = state.rules.filter((one) => one.rule_id !== rule.rule_id);
  renderRules();
  // The margin of the fourth folio names the rules of the draft. A rule that
  // goes away must not stay in that margin.
  if (state.tx) renderFolios(state.tx);

  slip(
    "The rule is deleted",
    "The database keeps the record of it, so an earlier draft still names it.",
    "warn",
    { label: "Undo", run: () => undoDelete(rule, previous) },
  );
}

/** Put a rule that a delete took away back in the state that it had. */
async function undoDelete(rule, previous) {
  try {
    await postJson(`/api/v1/rules/${encodeURIComponent(rule.rule_id)}`, { state: previous });
  } catch (error) {
    slip("The rule did not come back", error.message, "bad");
    return;
  }
  rule.state = previous;
  state.rules.push(rule);
  renderRules();
  if (state.tx) renderFolios(state.tx);
  slip("The rule is back", `It is ${previous} again.`, "ok");
}

/** Listen for a new rule from the form in the voice panel. */
export function connectRules() {
  el.newRule.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = el.ruleText.value.trim();
    if (!text) {
      el.ruleText.focus();
      return;
    }
    const owner = el.userId.value.trim() || "default";
    try {
      const rule = await postJson("/api/v1/rules", { user_id: owner, text });
      state.rules.push(rule);
      renderRules();
      el.ruleText.value = "";
      slip(
        "The rule is proposed",
        "It does nothing until you turn it on. That one click is the whole governance rule.",
        "ok",
      );
    } catch (error) {
      slip("The rule did not save", error.message, "bad");
    }
  });
}
