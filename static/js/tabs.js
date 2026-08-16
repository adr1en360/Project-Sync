/*
  The tabs.

  The page is one dashboard with four tabs, and each tab is one step of the work.
  One panel is visible. Each other panel carries the `hidden` attribute, so a
  screen reader does not read it and the tab key does not go into it.

  Two different ideas sit on each tab, and they must stay separate:

    `aria-selected`  which tab the operator looks at now.
    `data-state`     how far that step went: idle, active, done or failed.

  So the operator sees which steps finished and which step failed from the strip
  of tabs, with no click. `05-tabs.css` shows the state.

  The keyboard follows the ARIA tabs pattern. The left and right arrows move to
  the next tab and show it, because a panel costs nothing to show. The tab key
  leaves the strip and goes into the panel, because only the selected tab holds
  `tabindex="0"`.
*/

import { TAB_NAMES, tabs } from "./dom.js";
import { SAVED_TAB } from "./state.js";

/** The name of the tab that the page shows now. */
let current = "intake";

/** Give the name of the tab that the page shows now. */
export function openTab() {
  return current;
}

/**
 * Show one tab and hide the other three.
 * The function moves the focus only when a person pressed a key or a button.
 * A step that finishes moves the tab by itself, and it must not take the focus
 * from the field that the operator writes in.
 */
export function showTab(name, options = {}) {
  if (!TAB_NAMES.includes(name)) return;
  current = name;

  for (const key of TAB_NAMES) {
    const pair = tabs[key];
    if (!pair || !pair.tab || !pair.pane) continue;
    const shown = key === name;
    pair.tab.setAttribute("aria-selected", String(shown));
    pair.tab.setAttribute("tabindex", shown ? "0" : "-1");
    pair.pane.hidden = !shown;
  }

  localStorage.setItem(SAVED_TAB, name);
  writeHash(name);

  if (options.focus && tabs[name] && tabs[name].tab) tabs[name].tab.focus();
}

/**
 * Put the name of the tab in the address, so a reload opens the same tab and a
 * link can name one tab.
 * The function writes the history entry again and adds none, because a tab is
 * not a page and the back button must leave the dashboard.
 */
function writeHash(name) {
  if (typeof history !== "object" || !history) return;
  if (typeof history.replaceState !== "function") return;
  history.replaceState(null, "", `#${name}`);
}

/**
 * Say how far one step went.
 * The four values are idle, active, done and failed. `05-tabs.css` gives each
 * one a colour and a shape, because colour alone is not a signal.
 */
export function setTabState(name, value) {
  const pair = tabs[name];
  if (pair && pair.tab) pair.tab.dataset.state = value;
}

/**
 * Read one transaction row and mark the steps from it.
 * The function is the reason the strip of tabs is evidence and not decoration.
 */
export function syncTabs(tx) {
  if (!tx) {
    setTabState("intake", "active");
    setTabState("run", "idle");
    setTabState("review", "idle");
    return;
  }

  const status = String(tx.status || "");
  const failed = status.startsWith("FAILED");

  // A record exists, so the work of the first tab is complete.
  setTabState("intake", "done");

  if (failed) setTabState("run", "failed");
  else if (status === "RUNNING") setTabState("run", "active");
  else setTabState("run", "done");

  if (failed) setTabState("review", "failed");
  else if (status === "PENDING_APPROVAL") setTabState("review", "active");
  else if (tx.recommendation) setTabState("review", "done");
  else setTabState("review", "idle");
}

/** Give the tab that the address names, or the tab of the last visit. */
function firstTab() {
  const fromHash = String(location.hash || "").replace(/^#/, "");
  if (TAB_NAMES.includes(fromHash)) return fromHash;
  const saved = localStorage.getItem(SAVED_TAB);
  if (TAB_NAMES.includes(saved)) return saved;
  return "intake";
}

/** Listen for a click and for the arrow keys on the strip of tabs. */
export function connectTabs() {
  for (const name of TAB_NAMES) {
    const pair = tabs[name];
    if (!pair || !pair.tab) continue;

    pair.tab.addEventListener("click", () => showTab(name));

    pair.tab.addEventListener("keydown", (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (step) {
        event.preventDefault();
        const at = TAB_NAMES.indexOf(name);
        const to = (at + step + TAB_NAMES.length) % TAB_NAMES.length;
        showTab(TAB_NAMES[to], { focus: true });
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        showTab(TAB_NAMES[0], { focus: true });
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        showTab(TAB_NAMES[TAB_NAMES.length - 1], { focus: true });
      }
    });
  }

  showTab(firstTab());
}
