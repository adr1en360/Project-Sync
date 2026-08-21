/*
  The sideboard: the rail at the right of the work, the drawer that replaces it
  in a narrow window, and the lists of the library.

  One load, many lists. The same three sets of data appear in more than one
  place: the history is in the rail, in the drawer, and twice in the library. So
  each loader below reads the service one time and writes the answer to every
  list in that set. `dom.js` holds the sets. Nothing here copies markup from one
  list into another one, because a copy of markup is a second source of truth.

  Every line comes from `document.createElement` and `textContent`, and no line
  comes from `innerHTML`. The text of a line is the name of a repository and the
  words of a draft, so it is text that this page did not write.

  A line that opens a record is a real `button`. A line that only reports is a
  `div`. So the keyboard reaches each thing that acts, and it stops on nothing
  that does not act.

  The rail has two widths, and the choice goes on `main` as `data-rail`, and not
  on the rail itself. `03-shell.css` reads that attribute for the width of the
  column, and only the element that holds a grid can size a column of it.
*/

import { api } from "./api.js";
import { el, rail } from "./dom.js";
import { renderLedger } from "./ledger.js";
import { renderSheet } from "./sheet.js";
import { SAVED_RAIL, SAVED_TX, state } from "./state.js";
import { showTab, syncTabs } from "./tabs.js";

/** The states where the commits went out. Those records are the showcase. */
const SHOWCASE = new Set(["COMPLETED", "PARTIAL"]);

/** How many lines each list of the sideboard holds. */
const LIMIT = 10;

/** The mark for a value that a row does not have. */
const NONE = "—";

/* ------------------------------------------------------------------ */
/* The words of one line                                              */
/* ------------------------------------------------------------------ */

/** Give the name of the operator that the intake form holds. */
function who() {
  const name = el.userId && el.userId.value ? el.userId.value.trim() : "";
  return name || "default";
}

/** Cut a draft to one line, because a list of the sideboard is 280px wide. */
function cut(text, max = 60) {
  const words = String(text || "").replace(/\s+/g, " ").trim();
  if (!words) return NONE;
  return words.length > max ? `${words.slice(0, max)}…` : words;
}

/** Give the date of a row in the words of the operating system. */
function when(stamp) {
  if (!stamp) return NONE;
  const at = new Date(stamp);
  return Number.isNaN(at.getTime()) ? NONE : at.toLocaleString();
}

/** Give a status in words, and not in the shape that Firestore holds. */
function plain(status) {
  const words = String(status || "").replace(/_/g, " ").toLowerCase();
  return words || NONE;
}

/* ------------------------------------------------------------------ */
/* One line, and one list                                             */
/* ------------------------------------------------------------------ */

/**
 * Give one line of a list of the sideboard.
 *
 * The line becomes a button when `open` has a value, because a line that acts
 * must answer the keyboard as well as the mouse. `active` marks the record that
 * the desk shows now, and it writes `aria-current` as well as the class, so the
 * mark is not colour alone.
 */
function line(title, meta, { open, active } = {}) {
  const li = document.createElement("li");
  const box = document.createElement(open ? "button" : "div");
  box.className = active ? "rail__item rail__item--active" : "rail__item";
  if (open) {
    box.type = "button";
    box.addEventListener("click", open);
  }
  if (active) box.setAttribute("aria-current", "true");

  const top = document.createElement("div");
  top.className = "rail__item-title";
  top.textContent = title;

  const foot = document.createElement("div");
  foot.className = "rail__item-meta";
  foot.textContent = meta;

  box.append(top, foot);
  li.append(box);
  return li;
}

/** Put one line of words in every list of a set. An empty list says nothing. */
function note(lists, words) {
  for (const list of lists || []) {
    const li = document.createElement("li");
    li.className = "rail__empty";
    li.textContent = words;
    list.replaceChildren(li);
  }
}

/**
 * Write one set of rows to every list that shows them.
 * Each list builds its own elements, because one element cannot be in two
 * lists at the same time.
 */
function fill(lists, rows, empty, build) {
  if (!rows.length) {
    note(lists, empty);
    return;
  }
  for (const list of lists || []) list.replaceChildren(...rows.map(build));
}

/* ------------------------------------------------------------------ */
/* The record that a line opens                                       */
/* ------------------------------------------------------------------ */

/**
 * Put one record back on the desk, and go to the panel that shows it.
 * A line that names the record that is already open does nothing, so a second
 * press costs no request.
 */
async function openRow(txId) {
  if (state.tx && state.tx.tx_id === txId) return;
  try {
    const row = await api(`/api/v1/transactions/${encodeURIComponent(txId)}`);
    state.tx = row;
    localStorage.setItem(SAVED_TX, row.tx_id);
    renderLedger(row);
    renderSheet(row);
    syncTabs(row);
    showTab("review");
    if (rail.drawer && rail.drawer.dataset.open === "true") closeDrawer();
    loadHistory();
  } catch {
    // The row went away between the read of the list and the press, so the list
    // is the thing that is wrong. Read it again.
    loadHistory();
  }
}

/* ------------------------------------------------------------------ */
/* The three loaders                                                  */
/* ------------------------------------------------------------------ */

/** Read the recent runs into the rail, the drawer, and two library lists. */
export async function loadHistory() {
  let rows = [];
  try {
    rows = await api(`/api/v1/transactions?user_id=${encodeURIComponent(who())}&limit=${LIMIT}`);
  } catch {
    note(rail.lists.history, "The history did not load.");
    note(rail.lists.showcase, "The history did not load.");
    return;
  }

  const build = (row) =>
    line(row.repo_name || row.repo_url || NONE, `${plain(row.status)} · ${when(row.created_at)}`, {
      open: () => openRow(row.tx_id),
      active: Boolean(state.tx) && state.tx.tx_id === row.tx_id,
    });

  fill(rail.lists.history, rows, "No runs yet.", build);
  fill(
    rail.lists.showcase,
    rows.filter((row) => SHOWCASE.has(String(row.status))),
    "No record is approved yet.",
    build,
  );
}

/** Read the recent bullets into the rail, the drawer, and the library. */
export async function loadBullets() {
  let rows = [];
  try {
    rows = await api(`/api/v1/bullets?user_id=${encodeURIComponent(who())}&limit=${LIMIT}`);
  } catch {
    note(rail.lists.bullets, "The bullets did not load.");
    return;
  }

  fill(rail.lists.bullets, rows, "No bullets yet.", (row) =>
    line(cut(row.text), `${row.project || NONE} · ${when(row.created_at)}`),
  );
}

/** Read the recent social drafts into the rail and the drawer. */
export async function loadSocialDrafts() {
  let rows = [];
  try {
    rows = await api(`/api/v1/social-drafts?user_id=${encodeURIComponent(who())}&limit=${LIMIT}`);
  } catch {
    note(rail.lists.social, "The drafts did not load.");
    return;
  }

  fill(rail.lists.social, rows, "No drafts yet.", (row) =>
    line(cut(row.text), `${row.platform || NONE} / ${row.tone || NONE} · ${when(row.created_at)}`),
  );
}

/** Read all three sets again. A run that ends changes every one of them. */
export function reloadRail() {
  loadHistory();
  loadBullets();
  loadSocialDrafts();
}

/* ------------------------------------------------------------------ */
/* The two widths of the rail                                         */
/* ------------------------------------------------------------------ */

/**
 * Set the width of the rail and remember it.
 * The attribute goes on `main`, because the grid of the work holds the width of
 * the column and only the element with the grid can change it.
 */
export function setRail(mode) {
  const open = mode !== "collapsed";
  if (el.work) el.work.dataset.rail = open ? "open" : "collapsed";
  if (rail.collapse) {
    rail.collapse.setAttribute("aria-expanded", String(open));
    rail.collapse.setAttribute("aria-label", open ? "Make the sideboard narrow" : "Make the sideboard wide");
  }
  localStorage.setItem(SAVED_RAIL, open ? "open" : "collapsed");
}

/** Open the rail and put the focus on the heading of one list. */
function openRailAt(section) {
  setRail("open");
  const heading = rail.heading[section];
  if (heading) heading.focus();
}

/* ------------------------------------------------------------------ */
/* The drawer                                                         */
/* ------------------------------------------------------------------ */

/** Bring the drawer in, and put the focus in it. */
function openDrawer() {
  if (!rail.drawer) return;
  rail.drawer.dataset.open = "true";
  rail.drawer.setAttribute("aria-hidden", "false");
  if (rail.drawerClose) rail.drawerClose.focus();
}

/** Send the drawer out, and give the focus back to the button that opened it. */
function closeDrawer() {
  if (!rail.drawer) return;
  rail.drawer.dataset.open = "false";
  rail.drawer.setAttribute("aria-hidden", "true");
  if (rail.toggle) rail.toggle.focus();
}

/* ------------------------------------------------------------------ */
/* The wiring                                                         */
/* ------------------------------------------------------------------ */

/** Connect the sideboard, and read the three sets one time. */
export function connectRail() {
  setRail(localStorage.getItem(SAVED_RAIL) === "collapsed" ? "collapsed" : "open");

  if (rail.collapse) {
    rail.collapse.addEventListener("click", () => {
      const open = !el.work || el.work.dataset.rail !== "collapsed";
      setRail(open ? "collapsed" : "open");
    });
  }

  for (const button of rail.mini) {
    button.addEventListener("click", () => openRailAt(button.dataset.section));
  }

  if (rail.toggle) rail.toggle.addEventListener("click", openDrawer);
  if (rail.drawerClose) rail.drawerClose.addEventListener("click", closeDrawer);

  // A press on the ground behind the drawer closes it, and a press inside the
  // panel does not. The target is the ground only when the press missed the panel.
  if (rail.drawer) {
    rail.drawer.addEventListener("click", (event) => {
      if (event.target === rail.drawer) closeDrawer();
    });
    rail.drawer.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDrawer();
    });
  }

  reloadRail();
}
