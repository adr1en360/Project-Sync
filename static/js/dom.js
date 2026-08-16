/*
  The elements of the page, and the two builders that make a new element.

  Every id of the page is in this one file. A module reads `el` or `folio` and
  calls no `getElementById` of its own. So a change to an id in `index.html`
  needs a change in one place.

  The script tag has `type="module"`, and a module runs after the browser reads
  the whole document. So each element below is present when this file runs.
*/

const $ = (id) => document.getElementById(id);

export const el = {
  health: { model: $("h-model"), route: $("h-route"), status: $("h-status") },
  configStrip: $("config-strip"),
  intake: $("intake"),
  repoUrl: $("repo-url"),
  userId: $("user-id"),
  commitSha: $("commit-sha"),
  begin: $("begin"),
  intakeError: $("intake-error"),
  ledger: $("ledger"),
  poll: $("poll"),
  newRule: $("new-rule"),
  ruleText: $("rule-text"),
  rules: $("rules"),
  sheet: $("sheet"),
  stamp: $("stamp"),
  txid: $("txid"),
  proj: $("proj"),
  tagline: $("tagline"),
  facts: $("facts"),
  verdict: $("verdict"),
  verdictLine: $("verdict-line"),
  verdictReasons: $("verdict-reasons"),
  verdictMissing: $("verdict-missing"),
  folios: $("folios"),
  appliedRules: $("applied-rules"),
  act: $("act"),
  actNote: $("act-note"),
  regenerate: $("regenerate"),
  discard: $("discard"),
  approve: $("approve"),
  receipts: $("receipts"),
  slips: $("slips"),
  colophonModel: $("c-model"),
  themeToggle: $("theme-toggle"),
};

/*
  The four tabs, in the order that the operator reads them.

  `tabs.js` walks this list, so the order here is the order of the arrow keys.
*/
export const TAB_NAMES = ["intake", "run", "review", "voice"];

/* Each tab, with the panel that it controls. */
export const tabs = {
  intake: { tab: $("tab-intake"), pane: $("panel-intake") },
  run: { tab: $("tab-run"), pane: $("panel-run") },
  review: { tab: $("tab-review"), pane: $("panel-review") },
  voice: { tab: $("tab-voice"), pane: $("panel-voice") },
};

/* The four editable boxes, each with the meter below it. */
export const folio = {
  doc: { box: $("f-doc"), meter: $("m-doc") },
  card: { box: $("f-card"), meter: $("m-card") },
  bullets: { box: $("f-bullets"), meter: $("m-bullets") },
  social: { box: $("f-social"), meter: $("m-social") },
};

/**
 * Give one term and value for a description list. The value becomes a link when
 * `href` has a value.
 * The function sets `textContent` and never `innerHTML`, because the text comes
 * from the service and from GitHub.
 */
export function fact(term, value, href) {
  const wrap = document.createElement("div");
  const dt = document.createElement("dt");
  dt.textContent = term;
  const dd = document.createElement("dd");
  if (href) {
    const link = document.createElement("a");
    link.href = href;
    link.textContent = value;
    link.rel = "noreferrer";
    dd.append(link);
  } else {
    dd.textContent = value;
  }
  wrap.append(dt, dd);
  return wrap;
}

/**
 * Read the words of a button.
 *
 * A button with an icon holds two children: the `svg` of the icon and a `span`
 * with the words. A button with no icon holds the words alone.
 */
export function buttonLabel(button) {
  const span = button.querySelector("span");
  return span ? span.textContent : button.textContent;
}

/**
 * Put new words in a button and keep the icon of it.
 *
 * `button.textContent = "Copied"` takes away every child of the button, so the
 * `svg` of the icon goes at the first press and it never comes back. This writes
 * into the `span` when the button has one, and the icon stays.
 */
export function setButtonLabel(button, words) {
  const span = button.querySelector("span");
  if (span) {
    span.textContent = words;
  } else {
    button.textContent = words;
  }
}

/** Fill a list with one line for each item. The old lines go away. */
export function listItems(target, items) {
  target.replaceChildren();
  for (const item of items || []) {
    const li = document.createElement("li");
    li.textContent = item;
    target.append(li);
  }
}
