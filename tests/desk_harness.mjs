/*
  Run the review desk under a fake DOM, in Node, with no browser.

  The interface has no build step and no framework, so it also had no test. This
  file gives it one. It builds the smallest DOM that the modules touch, answers
  each request with a canned body, imports `main.js`, and then reads the page that
  the modules wrote.

  Run it directly:

      node tests/desk_harness.mjs

  Or let pytest run it, which `test_review_desk.py` does. That test passes over
  this file when the machine has no Node.

  The harness found one defect that no HTTP probe can find: a module that throws
  at import stops the whole page, and the API answers each request as before. So
  test the interface here after a change to `static/js`.
*/

import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv[2] || path.join(HERE, "..", "static", "js");

/* ------------------------------------------------------------------ */
/* The fake DOM                                                       */
/* ------------------------------------------------------------------ */

const camel = (name) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/** Give one element that records each change that a module makes to it. */
function makeEl(tag = "div", id = "") {
  const node = {
    tagName: tag.toUpperCase(),
    id,
    kids: [],
    listeners: {},
    attrs: {},
    dataset: {},
    style: {},
    className: "",
    textContent: "",
    value: "",
    hidden: false,
    disabled: false,
    scrollHeight: 140,
    offsetWidth: 10,
    gone: false,
    append(...n) {
      node.kids.push(...n);
    },
    replaceChildren(...n) {
      node.kids.length = 0;
      node.kids.push(...n);
    },
    addEventListener(type, fn) {
      (node.listeners[type] ||= []).push(fn);
    },
    setAttribute(name, value) {
      if (name.startsWith("data-")) node.dataset[camel(name.slice(5))] = value;
      else node.attrs[name] = value;
    },
    removeAttribute(name) {
      if (name.startsWith("data-")) delete node.dataset[camel(name.slice(5))];
      else delete node.attrs[name];
    },
    getAttribute(name) {
      return name.startsWith("data-")
        ? node.dataset[camel(name.slice(5))]
        : node.attrs[name];
    },
    focus() {},
    select() {},
    scrollIntoView() {
      node.scrolled = true;
    },
    remove() {
      node.gone = true;
    },
    closest() {
      return null;
    },
    querySelector(sel) {
      return match(node, sel)[0] || null;
    },
    querySelectorAll(sel) {
      return match(node, sel);
    },
    /* Call every listener of one kind, as a real event does. */
    async fire(type, event = {}) {
      for (const fn of node.listeners[type] || []) {
        await fn({ preventDefault() {}, target: node, ...event });
      }
      await settle();
    },
  };
  return node;
}

/** Find the children that match one tag name or one class name. */
function match(root, sel) {
  const out = [];
  const walk = (node) => {
    for (const kid of node.kids) {
      const hit = sel.startsWith(".")
        ? String(kid.className).split(/\s+/).includes(sel.slice(1))
        : kid.tagName === sel.toUpperCase();
      if (hit) out.push(kid);
      walk(kid);
    }
  };
  walk(root);
  return out;
}

const byId = new Map();
const document = {
  kids: [],
  listeners: {},
  getElementById(id) {
    if (!byId.has(id)) byId.set(id, makeEl("div", id));
    return byId.get(id);
  },
  createElement(tag) {
    return makeEl(tag);
  },
  addEventListener(type, fn) {
    (document.listeners[type] ||= []).push(fn);
  },
  async fire(type, event) {
    for (const fn of document.listeners[type] || []) await fn(event);
    await settle();
  },
};

/* `index.html` gives these children. The fake DOM must give them too. */
const stamp = document.getElementById("stamp");
for (const cls of ["stamp__text", "stamp__sub"]) {
  const kid = makeEl("b");
  kid.className = cls;
  stamp.append(kid);
}

const ledger = document.getElementById("ledger");
for (const node of ["scan", "extract", "rules", "generate", "evaluate", "persist"]) {
  const li = makeEl("li");
  li.dataset.node = node;
  li.dataset.state = "idle";
  ledger.append(li);
}

const beginSpan = makeEl("span");
beginSpan.textContent = "Open a record";
document.getElementById("begin").append(beginSpan);

/* The three icons of the narrow rail. Each one names its list in `data-section`,
   as `index.html` does, because `js/rail.js` reads that value to know which list
   to open the rail at. */
for (const section of ["history", "bullets", "social"]) {
  document.getElementById(`rail-mini-${section}`).dataset.section = section;
}

document.getElementById("regenerate").textContent = "Write again with the active rules";
document.getElementById("approve").textContent = "Approve and commit";
document.getElementById("user-id").value = "default";

/* ------------------------------------------------------------------ */
/* The fake service                                                   */
/* ------------------------------------------------------------------ */

const store = new Map([
  ["ps.user", "kofi"],
  ["ps.tx", "tx-abc"],
]);

/* The card holds `demo_url`, and `PortfolioCard` in `models.py` does not keep
   that key. The meter below folio II must report it. */
const CARD = {
  title: "ProjectSync",
  tagline: "A finished repository becomes a career record.",
  stack: ["Python", "Google ADK"],
  highlights: ["One approval gate."],
  repo_url: "https://github.com/owner/name",
  demo_url: "https://example.com",
};

const ASSETS = {
  doc_sheet_md: "# ProjectSync\n\nFour words here now.",
  portfolio_card: CARD,
  resume_bullets: ["Built a six-node graph.", "Shipped a gate.", "Wrote the docs."],
  social_draft: "The problem came first.",
};

const PENDING = {
  tx_id: "tx-abc",
  repo_name: "owner/name",
  repo_url: "https://github.com/owner/name",
  user_id: "kofi",
  status: "PENDING_APPROVAL",
  created_at: "2026-08-16T09:00:00+00:00",
  metadata: {
    project_name: "ProjectSync",
    tagline: "A finished repository becomes a career record.",
    tech_stack: ["Python", "Google ADK"],
  },
  assets: ASSETS,
  recommendation: {
    recommendation: "FULL_PUBLISH",
    confidence: 0.82,
    reasons: ["The README explains the problem."],
    missing_elements: ["No test folder."],
  },
  style_rules_applied: ["rule-1"],
};

const RUNNING = {
  ...PENDING,
  tx_id: "tx-run",
  status: "RUNNING",
  assets: null,
  recommendation: null,
  style_rules_applied: [],
};

/* A record where both commits landed. A line of the history opens this one, so it
   holds the two commit hashes that the receipts read. */
const DONE = {
  ...PENDING,
  tx_id: "tx-done",
  repo_name: "owner/older",
  status: "COMPLETED",
  doc_commit_sha: "a1b2c3d4e5f60718",
  card_commit_sha: "192a3b4c5d6e7f80",
  completed_at: "2026-08-15T10:00:00+00:00",
};

/*
  The rows of the sideboard.

  The service gives the newest first, and `js/rail.js` writes one set of rows to
  every list that shows them. The three statuses are there on purpose: the
  showcase holds only the record that went out, and the history holds all three.
*/
const HISTORY = [
  {
    tx_id: "tx-abc",
    repo_name: "owner/name",
    repo_url: "https://github.com/owner/name",
    status: "PENDING_APPROVAL",
    created_at: "2026-08-16T09:00:00+00:00",
  },
  {
    tx_id: "tx-done",
    repo_name: "owner/older",
    repo_url: "https://github.com/owner/older",
    status: "COMPLETED",
    created_at: "2026-08-15T09:00:00+00:00",
  },
  {
    tx_id: "tx-bad",
    repo_name: "owner/broken",
    repo_url: "https://github.com/owner/broken",
    status: "FAILED_SCAN",
    created_at: "2026-08-14T09:00:00+00:00",
  },
];

const BULLETS = [
  {
    bullet_id: "b-1",
    user_id: "kofi",
    text: "Built a six-node graph that turns a repository into a career record.",
    project: "ProjectSync",
    created_at: "2026-08-16T09:05:00+00:00",
  },
];

const DRAFTS = [
  {
    draft_id: "d-1",
    user_id: "kofi",
    tx_id: "tx-abc",
    text: "The problem came first.",
    platform: "linkedin",
    tone: "professional",
    created_at: "2026-08-16T09:06:00+00:00",
  },
];

const RULES = [
  {
    rule_id: "rule-1",
    text: "Start with the problem, never with excitement.",
    state: "ACTIVE",
    source: "USER",
  },
  {
    rule_id: "rule-2",
    text: "Name the stack in the first two lines.",
    state: "PROPOSED",
    source: "CURATOR",
  },
];

const sent = [];

/* The rules that a delete took off the list. The service keeps the document and
   hides the rule, so this set holds the ids that the list must not give back. */
const hiddenRules = new Set();

function reply(body, status = 200) {
  const text = JSON.stringify(body);
  return { ok: status < 400, status, text: async () => text };
}

globalThis.document = document;
globalThis.location = { search: "" };
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, v),
  removeItem: (k) => store.delete(k),
};
/* `false` makes the autosize fallback run, which is the path that most browsers
   take today. */
globalThis.CSS = { supports: () => false };
/* Node has a `navigator` of its own, and that one has only a getter. */
Object.defineProperty(globalThis, "navigator", {
  value: { clipboard: { writeText: async () => {} } },
  configurable: true,
});
globalThis.confirm = () => true;

globalThis.fetch = async (path, options = {}) => {
  sent.push({ path, method: options.method || "GET", body: options.body });

  if (path === "/healthz") {
    return reply({
      model: "gemini-3.7-flash",
      use_vertex_ai: false,
      missing_config: ["GITHUB_TOKEN"],
    });
  }
  if (path.startsWith("/api/v1/rules?")) {
    return reply(RULES.filter((rule) => !hiddenRules.has(rule.rule_id)));
  }
  if (path === "/api/v1/transactions/tx-abc") return reply(PENDING);
  if (path === "/api/v1/transactions/tx-run") return reply(RUNNING);
  if (path === "/api/v1/transactions/tx-done") return reply(DONE);
  if (path === "/api/v1/trigger-sync") return reply({ transaction_id: "tx-run" });
  if (path === "/api/v1/regenerate-asset") {
    return reply({ assets: ASSETS, style_rules_applied: ["rule-1"] });
  }
  if (path === "/api/v1/approval-callback") {
    const payload = JSON.parse(options.body);
    if (!payload.approved) return reply({ status: "REJECTED" });
    return reply({
      status: "COMPLETED",
      proposed_rules: ["Keep a post under 200 characters."],
    });
  }
  if (path === "/api/v1/rules") {
    return reply({ rule_id: "rule-3", text: "New one.", state: "PROPOSED", source: "USER" });
  }
  if (path.startsWith("/api/v1/rules/")) {
    /* A DELETE hides the rule. The row itself stays, as it does in Firestore. */
    if (options.method === "DELETE") {
      const ruleId = decodeURIComponent(path.slice("/api/v1/rules/".length));
      hiddenRules.add(ruleId);
      return reply({ rule_id: ruleId, state: "DELETED" });
    }
    return reply({});
  }
  /* The three lists of the sideboard. `js/rail.js` reads each one once and writes
     the answer to the rail, the drawer, and the library. */
  if (path.startsWith("/api/v1/transactions?user_id=")) {
    return reply(HISTORY);
  }
  if (path.startsWith("/api/v1/bullets?user_id=")) {
    return reply(BULLETS);
  }
  if (path.startsWith("/api/v1/social-drafts?user_id=")) {
    return reply(DRAFTS);
  }
  return reply({ detail: `The harness has no route for ${path}` }, 404);
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

/* ------------------------------------------------------------------ */
/* The checks                                                         */
/* ------------------------------------------------------------------ */

let passed = 0;
const failures = [];

function check(name, got, want) {
  const ok = typeof want === "function" ? want(got) : got === want;
  if (ok) {
    passed += 1;
  } else {
    failures.push(`${name}\n      got:  ${JSON.stringify(got)}\n      want: ${want}`);
  }
}

const has = (text) => (got) => String(got).includes(text);

/* This import runs the whole page. A module that throws stops the harness here,
   which is the point: the browser also stops. */
await import(new URL("main.js", `file:///${ROOT.replace(/\\/g, "/")}/`).href);
await settle();
await settle();

const el = (id) => document.getElementById(id);

/* --- The masthead ------------------------------------------------- */
check("health model", el("h-model").textContent, "gemini-3.7-flash");
check("colophon model", el("c-model").textContent, "gemini-3.7-flash");
check("health route", el("h-route").textContent, "Gemini API");
check("health status", el("h-status").textContent, "up");
check("health ok flag", el("h-status").dataset.ok, "yes");
check("config strip shows", el("config-strip").hidden, false);
check("config strip names the value", el("config-strip").textContent, has("GITHUB_TOKEN"));
check("saved operator returns", el("user-id").value, "kofi");

/* --- The rules panel --------------------------------------------- */
check("rules count", el("rules").kids.length, 2);
check("the active rule sorts first", el("rules").kids[0].dataset.state, "ACTIVE");
check(
  "the rule text is on the line",
  el("rules").kids[0].kids[0].kids[0].textContent,
  has("Start with the problem"),
);
check(
  "the curator is named",
  el("rules").kids[1].kids[0].kids[1].textContent,
  has("the curator"),
);
check("the toggle reads off", el("rules").kids[0].kids[1].textContent, "Turn off");
check("the toggle is pressed", el("rules").kids[0].kids[1].attrs["aria-pressed"], "true");

/* --- The record that a reload puts back -------------------------- */
check("dossier number", el("txid").textContent, "tx-abc");
check("project name", el("proj").textContent, "ProjectSync");
check("tagline", el("tagline").textContent, has("career record"));
check("facts count", el("facts").kids.length, 5);
check(
  "the opened time carries a zone",
  el("facts").kids[3].kids[1].textContent,
  // The ISO shape must be gone, and the zone must be named. Do not test for the
  // letter T alone, because "GMT" holds one.
  (got) =>
    !/^\d{4}-\d{2}-\d{2}T/.test(got) && /2026/.test(got) && /(GMT|UTC|[A-Z]{3,4})/.test(got),
);

/* --- The three lists of the sideboard ---------------------------- */

/* One row of a list is `li > (button|div) > (title, meta)`. These three read that
   shape, so a check below says what it means and not how to walk to it. */
const row = (listId, at) => el(listId).kids[at].kids[0];
const rowTitle = (listId, at) => row(listId, at).kids[0].textContent;
const rowMeta = (listId, at) => row(listId, at).kids[1].textContent;

check("the history holds one line for each run", el("rail-history-list").kids.length, 3);
check("a history line names the repository", rowTitle("rail-history-list", 0), "owner/name");
check(
  "a history line says the status in words, and not as Firestore holds it",
  rowMeta("rail-history-list", 0),
  has("pending approval"),
);
check(
  "a line that opens a record is a button, so the keyboard reaches it",
  row("rail-history-list", 0).tagName,
  "BUTTON",
);
check(
  "the record that is open is marked, and not by colour alone",
  row("rail-history-list", 0).attrs["aria-current"],
  "true",
);
check(
  "no other line carries that mark",
  row("rail-history-list", 1).attrs["aria-current"],
  undefined,
);

/* One load writes to every list that shows the same rows. */
check("the drawer holds the same lines", el("rail-drawer-history-list").kids.length, 3);
check("the library holds the same lines", el("lib-history-list").kids.length, 3);
check(
  "the showcase holds only the records where the commits went out",
  el("lib-showcase-list").kids.length,
  1,
);
check("the showcase names that record", rowTitle("lib-showcase-list", 0), "owner/older");

check("the bullets are in the rail", el("rail-bullets-list").kids.length, 1);
check("a bullet line names the project", rowMeta("rail-bullets-list", 0), has("ProjectSync"));
check(
  "a line that only reports is a div, so the keyboard does not stop on it",
  row("rail-bullets-list", 0).tagName,
  "DIV",
);
check("the bullets are in the library too", el("lib-bullets-list").kids.length, 1);

check("the drafts are in the rail", el("rail-social-list").kids.length, 1);
check(
  "a draft line names the platform and the tone",
  rowMeta("rail-social-list", 0),
  has("linkedin / professional"),
);

/* --- The ledger of the six nodes --------------------------------- */check(
  "ledger all reported",
  ledger.kids.map((li) => li.dataset.state).join(","),
  "done,done,done,done,done,done",
);

/* --- The stamp --------------------------------------------------- */
check("stamp verdict", stamp.dataset.verdict, "FULL_PUBLISH");
check("stamp text", stamp.kids[0].textContent, "Full publish");
check("stamp sub", stamp.kids[1].textContent, "gate · passed");
check("stamp landed", stamp.dataset.land, "yes");

/* --- The gate ---------------------------------------------------- */
check("verdict shows", el("verdict").hidden, false);
check("verdict verb", el("verdict-line").kids[0].textContent, "Ready to show");
check("verdict confidence", el("verdict-line").kids[1].textContent, has("82% confidence"));
check("verdict reasons", el("verdict-reasons").kids.length, 1);
check("verdict missing", el("verdict-missing").kids.length, 1);

/* --- The four folios --------------------------------------------- */
check("folios show", el("folios").hidden, false);
check("folio I", el("f-doc").value, has("# ProjectSync"));
check("folio II is pretty JSON", el("f-card").value, has('\n  "title": "ProjectSync"'));
check("folio III is one line for each bullet", el("f-bullets").value.split("\n").length, 3);
check("folio IV", el("f-social").value, "The problem came first.");
check("autosize ran", el("f-doc").style.height, "144px");

check("meter I counts words", el("m-doc").textContent, "6 words · markdown");
check("meter III counts lines", el("m-bullets").textContent, "3 lines");
check("meter IV counts characters", el("m-social").textContent, has("23 characters · 280"));
check("meter II reports the key that the approval drops", el("m-card").textContent, has("demo_url"));
check("meter II warns", el("m-card").dataset.warn, "yes");

check(
  "the margin names the rule",
  el("applied-rules").kids[0].textContent,
  has("Start with the problem"),
);

/* --- The actions ------------------------------------------------- */
check("the act row shows", el("act").hidden, false);
check("approve is on", el("approve").disabled, false);
check("discard is on", el("discard").disabled, false);
check("write again is on", el("regenerate").disabled, false);
check("the note asks for a read", el("act-note").textContent, has("nothing reaches GitHub"));

/* --- A card that does not parse blocks the approval --------------- */
el("f-card").value = "{ not json";
await el("f-card").fire("input");
check("a bad card warns", el("m-card").dataset.warn, "yes");
check("a bad card names JSON", el("m-card").textContent, has("not valid JSON"));

const before = sent.length;
await el("approve").fire("click");
check("a bad card sends nothing", sent.length, before);
check(
  "a bad card gives a slip",
  el("slips").kids.at(-1).kids[1].textContent,
  has("not valid JSON"),
);

/* --- The approval carries the edits ------------------------------ */
el("f-card").value = JSON.stringify({ title: "Edited by hand", stack: ["Python"] });
await el("f-card").fire("input");
check("a clean card does not warn", el("m-card").dataset.warn, "no");
check("a clean card counts keys", el("m-card").textContent, "valid JSON · 2 keys");

/* How many times the page has read the history. A run that reaches a state which
   does not change again must read it again, or the sideboard reports the old
   status of the record that the operator just approved. */
const historyReads = () =>
  sent.filter((r) => r.path.startsWith("/api/v1/transactions?user_id=")).length;
const readsBeforeApproval = historyReads();

el("f-social").value = "An edit from the desk.";
await el("approve").fire("click");

const approval = sent.find((r) => r.path === "/api/v1/approval-callback");
check("the approval was sent", Boolean(approval), true);
const body = JSON.parse(approval.body);
check("the approval carries the id", body.transaction_id, "tx-abc");
check("the approval is true", body.approved, true);
check("the edited card goes with it", body.edited_assets.portfolio_card.title, "Edited by hand");
check("the edited post goes with it", body.edited_assets.social_draft, "An edit from the desk.");
check("the bullets keep their count", body.edited_assets.resume_bullets.length, 3);
const slipTitles = () => el("slips").kids.map((s) => s.kids[0].textContent).join("|");
check("both commits give a slip", slipTitles(), has("Both commits landed"));
check("the curator proposal gives a slip", slipTitles(), has("The curator proposes a rule"));
check("approve is on again", el("approve").disabled, false);
check("the approve label returns", el("approve").textContent, "Approve and commit");
check("the approval read the sideboard again", historyReads() > readsBeforeApproval, true);

/* --- Write again ------------------------------------------------- */
await el("regenerate").fire("click");
check(
  "write again sent the request",
  sent.some((r) => r.path === "/api/v1/regenerate-asset"),
  true,
);
check("the new draft is in folio IV", el("f-social").value, "The problem came first.");
check("the fresh mark is on", el("f-doc").dataset.fresh, "yes");
check(
  "the write again label returns",
  el("regenerate").textContent,
  "Write again with the active rules",
);

/* --- One rule goes off ------------------------------------------- */
await el("rules").kids[0].kids[1].fire("click");
const toggle = sent.filter((r) => r.path.startsWith("/api/v1/rules/")).at(-1);
check("the toggle sent a state", JSON.parse(toggle.body).state, "INACTIVE");
check("the rule that is off sorts last", el("rules").kids.at(-1).dataset.state, "INACTIVE");

/* --- A new rule -------------------------------------------------- */
el("rule-text").value = "  Keep every line short.  ";
await el("new-rule").fire("submit");
const made = sent.filter((r) => r.path === "/api/v1/rules" && r.method === "POST").at(-1);
check("the new rule was sent, with no space", JSON.parse(made.body).text, "Keep every line short.");
check("the new rule box is empty", el("rule-text").value, "");

/* --- The copy button --------------------------------------------- */
const copyButton = makeEl("button");
copyButton.dataset.copy = "f-doc";
copyButton.textContent = "Copy";
await document.fire("click", {
  target: { closest: (sel) => (sel === "[data-copy]" ? copyButton : null) },
});
check("the copy button reports", copyButton.textContent, "Copied");

/* --- The intake refuses a URL that is not GitHub ----------------- */
el("repo-url").value = "not a url";
await el("intake").fire("submit");
check("a bad URL shows an error", el("intake-error").hidden, false);
check("the error gives the form", el("intake-error").textContent, has("https://github.com/owner/name"));

/* --- The intake opens a record ----------------------------------- */
el("repo-url").value = "https://github.com/owner/name";
await el("intake").fire("submit");
check("trigger-sync was sent", sent.some((r) => r.path === "/api/v1/trigger-sync"), true);
check("the operator was saved", store.get("ps.user"), "kofi");
check("the new record was saved", store.get("ps.tx"), "tx-run");
check("the new dossier shows", el("txid").textContent, "tx-run");

/* A RUNNING row marks the first node that has not reported. */
check(
  "the ledger marks one active node",
  ledger.kids.map((li) => li.dataset.state).join(","),
  "done,done,active,idle,idle,idle",
);
check("the poll line counts", el("poll").textContent, has("Running · 1 check"));
check("a RUNNING row hides the folios", el("folios").hidden, true);
check("a RUNNING row turns the buttons off", el("approve").disabled, true);

/* --- The five tabs ----------------------------------------------- */

/*
  Library and Voice are not steps of the work, so `syncTabs` writes no state on
  those two. A number on a tab that is not a step would say that the work has five
  steps, and it has three.
*/
check("the intake step is done", el("tab-intake").dataset.state, "done");
check("the run step is active", el("tab-run").dataset.state, "active");
check("the library carries no state", el("tab-library").dataset.state, undefined);
check("the voice carries no state", el("tab-voice").dataset.state, undefined);

await el("tab-library").fire("click");
check("the library tab opens its panel", el("panel-library").hidden, false);
check("the panel of the run goes away", el("panel-run").hidden, true);
check("the library tab is the selected one", el("tab-library").attrs["aria-selected"], "true");
check("the tab that is open was remembered", store.get("ps.tab"), "library");

/* The right arrow on the last tab comes back to the first one, so the strip is a
   ring and a key press never reaches a dead end. */
await el("tab-voice").fire("keydown", { key: "ArrowRight" });
check("the arrow moves the selection", el("panel-intake").hidden, false);
await el("tab-library").fire("click");

/* --- The three parts of the library ------------------------------ */

check("the library opens at the bullets", el("lib-view-bullets").hidden, false);
check("the other two parts wait", el("lib-view-showcase").hidden, true);
check("the bullets segment is selected", el("lib-tab-bullets").attrs["aria-selected"], "true");

await el("lib-tab-showcase").fire("click");
check("a press opens the showcase", el("lib-view-showcase").hidden, false);
check("the bullets go away", el("lib-view-bullets").hidden, true);
check("the segment that is open was remembered", store.get("ps.lib"), "showcase");

await el("lib-tab-showcase").fire("keydown", { key: "ArrowRight" });
check("the arrow moves to the history", el("lib-view-history").hidden, false);
await el("lib-tab-history").fire("keydown", { key: "Home" });
check("Home comes back to the bullets", el("lib-view-bullets").hidden, false);

/* --- The two widths of the sideboard ----------------------------- */

check("the rail starts open", el("main").dataset.rail, "open");
check("the width was remembered", store.get("ps.rail"), "open");
check("the control says the state", el("rail-collapse").attrs["aria-expanded"], "true");

await el("rail-collapse").fire("click");
check("the control makes the rail narrow", el("main").dataset.rail, "collapsed");
check("the narrow rail was remembered", store.get("ps.rail"), "collapsed");
check("the control says the new state", el("rail-collapse").attrs["aria-expanded"], "false");
check(
  "the label of the control turns over",
  el("rail-collapse").attrs["aria-label"],
  "Make the sideboard wide",
);

/* Nothing goes away with the narrow rail: each icon opens the rail again at its
   own list, and the rows are the same rows. */
await el("rail-mini-bullets").fire("click");
check("an icon of the narrow rail opens the rail again", el("main").dataset.rail, "open");
check("the rows are still there", el("rail-bullets-list").kids.length, 1);

/* --- The drawer -------------------------------------------------- */

await el("rail-toggle").fire("click");
check("the button brings the drawer in", el("rail-drawer").dataset.open, "true");
check("the drawer is not hidden from a screen reader", el("rail-drawer").attrs["aria-hidden"], "false");

await el("rail-drawer").fire("keydown", { key: "Escape" });
check("Escape sends the drawer out", el("rail-drawer").dataset.open, "false");
check("the drawer is hidden again", el("rail-drawer").attrs["aria-hidden"], "true");

await el("rail-toggle").fire("click");
await el("rail-drawer-close").fire("click");
check("the close button sends the drawer out", el("rail-drawer").dataset.open, "false");

/* A press on the ground behind the panel closes the drawer, and a press inside
   the panel does not. The target of the event is what tells the two apart. */
await el("rail-toggle").fire("click");
await el("rail-drawer").fire("click", { target: el("rail-drawer-close") });
check("a press inside the panel keeps the drawer in", el("rail-drawer").dataset.open, "true");
await el("rail-drawer").fire("click", { target: el("rail-drawer") });
check("a press on the ground sends it out", el("rail-drawer").dataset.open, "false");

/* --- A line of the history puts a record back on the desk -------- */

await row("rail-history-list", 1).fire("click");
check("the older record is on the desk", el("txid").textContent, "tx-done");
check("that record was saved for the next reload", store.get("ps.tx"), "tx-done");
check("the desk went to the panel that shows it", el("panel-review").hidden, false);
check("the mark moved to that line", row("rail-history-list", 1).attrs["aria-current"], "true");
check("the mark left the line that was open", row("rail-history-list", 0).attrs["aria-current"], undefined);
check("the receipts of that record show", el("receipts").hidden, false);
/* The first receipt carries a link, so its words are in the link and not in the
   cell that holds it. */
check(
  "the receipt names the commit",
  el("receipts").kids[0].kids[1].kids[0].textContent,
  has("a1b2c3d4e5f6"),
);
check(
  "the receipt links that commit",
  el("receipts").kids[0].kids[1].kids[0].href,
  has("/commit/a1b2c3d4e5f60718"),
);

/* A second press on the same line costs no request, because that record is
   already the record on the desk. */
const readsBeforeSecond = sent.length;
await row("rail-history-list", 1).fire("click");
check("a second press on the same line sends nothing", sent.length, readsBeforeSecond);

/* ------------------------------------------------------------------ */

console.log(`${passed} checks passed, ${failures.length} failed.`);
if (failures.length) {
  console.log("\nFailures:");
  for (const failure of failures) console.log(`  x ${failure}`);
}

/* The poll set a timer for the RUNNING row. Stop the process, or Node waits. */
process.exit(failures.length ? 1 : 0);
