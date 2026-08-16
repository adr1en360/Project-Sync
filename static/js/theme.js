/*
  The theme of the page.

  The page follows the theme of the operating system until the operator makes a
  choice. A choice goes to `localStorage` and stays after a reload. An operator
  who makes no choice keeps the theme of the system, and the page changes with
  the system while it is open.

  `01-tokens.css` holds the colour of both themes. It writes the dark values two
  times: one time in a `prefers-color-scheme` block for the system, and one time
  in a `[data-theme="dark"]` block for a choice. So this module writes one
  attribute and calculates no colour.

  Each browser interface below has a test, because the test harness gives a
  document that has no `documentElement` and no `matchMedia`.
*/

import { el } from "./dom.js";
import { SAVED_THEME } from "./state.js";

/* The `<html>` element. The harness document has none, so the value can be null. */
const root = document.documentElement || null;

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Give the media query object, or null when the browser has no `matchMedia`. */
function darkQuery() {
  if (typeof matchMedia !== "function") return null;
  return matchMedia(DARK_QUERY);
}

/** Give the theme that the system asks for. */
function systemTheme() {
  const query = darkQuery();
  if (!query) return "light";
  return query.matches ? "dark" : "light";
}

/** Give the choice of the operator, or an empty string for no choice. */
function chosenTheme() {
  const value = localStorage.getItem(SAVED_THEME);
  return value === "dark" || value === "light" ? value : "";
}

/** Give the theme that the page shows now. */
function activeTheme() {
  return chosenTheme() || systemTheme();
}

/**
 * Tell the operator what the button does next.
 * The button holds an icon and no text, so the name must come from an attribute.
 */
function label() {
  if (!el.themeToggle) return;
  const next = activeTheme() === "dark" ? "light" : "dark";
  const words = `Use the ${next} theme`;
  el.themeToggle.setAttribute("aria-label", words);
  el.themeToggle.setAttribute("title", words);
}

/**
 * Put the theme on the page.
 *
 * The function also writes `color-scheme`. The scroll bars, the caret and the
 * native parts of a form read that property, and they do not read the tokens. A
 * page that does not write it shows light scroll bars on a dark page.
 *
 * A page with no choice carries no `data-theme` attribute. The attribute is
 * absent, so the CSS follows the system without help.
 */
function paint() {
  if (!root) return;
  const choice = chosenTheme();
  if (choice) {
    root.setAttribute("data-theme", choice);
    root.style.colorScheme = choice;
  } else {
    root.removeAttribute("data-theme");
    root.style.colorScheme = "light dark";
  }
  label();
}

/** Listen for the button, and for a change of the system theme. */
export function connectTheme() {
  paint();

  if (el.themeToggle) {
    el.themeToggle.addEventListener("click", () => {
      localStorage.setItem(SAVED_THEME, activeTheme() === "dark" ? "light" : "dark");
      paint();
    });
  }

  // The system theme can change while the page is open. The page follows it
  // only while the operator made no choice.
  const query = darkQuery();
  if (query && typeof query.addEventListener === "function") {
    query.addEventListener("change", () => {
      if (!chosenTheme()) paint();
    });
  }
}
