/*
  The library, and the segmented control that moves between its three parts.

  The library holds three lists: the bullets that the operator kept, the records
  that the commits went out for, and every run. Those three are one group, so
  they take a segmented control inside one panel, and not three more tabs at the
  top of the page. A tab strip of eight names says that the work has eight steps,
  and it has three.

  The control follows the same ARIA pattern as the tab strip in `tabs.js`: one
  `tablist`, `aria-selected` on the button, `hidden` on every view but one, and
  the arrows move the selection. `js/rail.js` fills the three lists.
*/

import { LIB_VIEWS, libViews } from "./dom.js";
import { SAVED_LIB } from "./state.js";

/** The part of the library that the page shows now. */
let current = "bullets";

/** Give the part of the library that the page shows now. */
export function openView() {
  return current;
}

/**
 * Show one part of the library and hide the other two.
 * The function moves the focus only when a person pressed a key or a button, in
 * the same way as `showTab` in `tabs.js`.
 */
export function showView(name, options = {}) {
  if (!LIB_VIEWS.includes(name)) return;
  current = name;

  for (const key of LIB_VIEWS) {
    const pair = libViews[key];
    if (!pair || !pair.tab || !pair.view) continue;
    const shown = key === name;
    pair.tab.setAttribute("aria-selected", String(shown));
    pair.tab.setAttribute("tabindex", shown ? "0" : "-1");
    pair.view.hidden = !shown;
  }

  localStorage.setItem(SAVED_LIB, name);

  if (options.focus && libViews[name] && libViews[name].tab) libViews[name].tab.focus();
}

/** Give the part of the library that the last visit left open. */
function firstView() {
  const saved = localStorage.getItem(SAVED_LIB);
  return LIB_VIEWS.includes(saved) ? saved : LIB_VIEWS[0];
}

/** Listen for a click and for the arrow keys on the segmented control. */
export function connectLibrary() {
  for (const name of LIB_VIEWS) {
    const pair = libViews[name];
    if (!pair || !pair.tab) continue;

    pair.tab.addEventListener("click", () => showView(name));

    pair.tab.addEventListener("keydown", (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (step) {
        event.preventDefault();
        const at = LIB_VIEWS.indexOf(name);
        const to = (at + step + LIB_VIEWS.length) % LIB_VIEWS.length;
        showView(LIB_VIEWS[to], { focus: true });
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        showView(LIB_VIEWS[0], { focus: true });
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        showView(LIB_VIEWS[LIB_VIEWS.length - 1], { focus: true });
      }
    });
  }

  showView(firstView());
}
