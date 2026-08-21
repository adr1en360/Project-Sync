/*
  The elements of the page, and the two builders that make a new element.

  Every id that a module names is in this one file. A module reads `el`, `tabs`,
  `rail`, `libViews`, or `folio`, and it writes no id of its own. So a change to
  an id in `index.html` needs a change in one place. `js/folios.js` is the one
  file that looks an element up outside this one, and it takes the id from the
  `data-copy` attribute of the button, so it names no id either.

  The script tag has `type="module"`, and a module runs after the browser reads
  the whole document. So each element below is present when this file runs.
*/

const $ = (id) => document.getElementById(id);

export const el = {
  health: { model: $("h-model"), route: $("h-route"), status: $("h-status") },
  configStrip: $("config-strip"),
  work: $("main"),
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
  The five tabs, in the order that the operator reads them.

  The first three are the three steps of the work. Library and Voice hold
  reference material and no step, so `tabs.js` writes no state on those two.

  `tabs.js` walks this list, so the order here is the order of the arrow keys.
*/
export const TAB_NAMES = ["intake", "run", "review", "library", "voice"];

/* Each tab, with the panel that it controls. */
export const tabs = {
  intake: { tab: $("tab-intake"), pane: $("panel-intake") },
  run: { tab: $("tab-run"), pane: $("panel-run") },
  review: { tab: $("tab-review"), pane: $("panel-review") },
  library: { tab: $("tab-library"), pane: $("panel-library") },
  voice: { tab: $("tab-voice"), pane: $("panel-voice") },
};

/*
  The sideboard, the drawer, and the lists of the library.

  Three sets of data go to more than one list. The history goes to the rail, to
  the drawer, and to two lists in the library. So each name below holds every
  list that shows that data, and `js/rail.js` reads the data one time and writes
  it to each list in the set.

  `some` drops an empty value, so a set stays a list of real elements and
  `rail.js` needs no test for `null`. That drop must not hide a wrong letter, so
  `tests/test_review_desk.py` holds every id in this file to the ids of
  `index.html`.
*/
const some = (...ids) => ids.map((id) => $(id)).filter(Boolean);

export const rail = {
  root: $("rail"),
  toggle: $("rail-toggle"),
  collapse: $("rail-collapse"),
  drawer: $("rail-drawer"),
  drawerClose: $("rail-drawer-close"),
  mini: some("rail-mini-history", "rail-mini-bullets", "rail-mini-social"),
  heading: {
    history: $("rail-history-h"),
    bullets: $("rail-bullets-h"),
    social: $("rail-social-h"),
  },
  lists: {
    history: some("rail-history-list", "rail-drawer-history-list", "lib-history-list"),
    bullets: some("rail-bullets-list", "rail-drawer-bullets-list", "lib-bullets-list"),
    social: some("rail-social-list", "rail-drawer-social-list"),
    showcase: some("lib-showcase-list"),
  },
};

/*
  The three parts of the library.

  The order here is the order of the arrow keys inside the segmented control,
  and `js/library.js` walks this list.
*/
export const LIB_VIEWS = ["bullets", "showcase", "history"];

export const libViews = {
  bullets: { tab: $("lib-tab-bullets"), view: $("lib-view-bullets") },
  showcase: { tab: $("lib-tab-showcase"), view: $("lib-view-showcase") },
  history: { tab: $("lib-tab-history"), view: $("lib-view-history") },
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
