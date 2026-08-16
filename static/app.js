/*
  ProjectSync — the review desk.

  No framework and no build step. The page talks to the same FastAPI service
  that serves it, so every path here is relative.

  The API that this file drives:
    GET  /healthz
    POST /api/v1/trigger-sync        {repo_url, user_id, commit_sha?}
    GET  /api/v1/transactions/{id}
    POST /api/v1/regenerate-asset    {transaction_id}
    POST /api/v1/approval-callback   {transaction_id, approved, edited_assets?}
    GET  /api/v1/rules?user_id=
    POST /api/v1/rules               {user_id, text}
    POST /api/v1/rules/{id}          {state}

  A graph workflow does not support live streaming, so this page polls the
  transaction row. It does not hold a connection open.
*/

/* An operator can point the page at a different host with ?api=… */
const API = new URLSearchParams(location.search).get("api") || "";

const POLL_MS = 1600;
const POLL_LIMIT = 150; // about four minutes
const POST_LIMIT = 280; // the character limit of one social post

const $ = (id) => document.getElementById(id);

const el = {
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
};

const folio = {
  doc: { box: $("f-doc"), meter: $("m-doc") },
  card: { box: $("f-card"), meter: $("m-card") },
  bullets: { box: $("f-bullets"), meter: $("m-bullets") },
  social: { box: $("f-social"), meter: $("m-social") },
};

const state = {
  tx: null,
  rules: [],
  polls: 0,
  timer: null,
  stamped: "", // the verdict that the stamp shows now
};

/* Some browsers size a textarea from its content. The rest need help. */
const NATIVE_SIZING =
  typeof CSS !== "undefined" && CSS.supports && CSS.supports("field-sizing", "content");

/* ---------------------------------------------------------------- */
/* The API                                                          */
/* ---------------------------------------------------------------- */

/**
 * Call the service and give the parsed body.
 * The function throws an Error that holds the message of the service, because
 * the operator must read the real reason and not a code.
 */
async function api(path, options = {}) {
  const response = await fetch(API + path, {
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    ...options,
  });

  let body = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { detail: text };
    }
  }

  if (!response.ok) {
    const detail = body && body.detail ? body.detail : `HTTP ${response.status}`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return body;
}

const postJson = (path, payload) =>
  api(path, { method: "POST", body: JSON.stringify(payload) });

/* ---------------------------------------------------------------- */
/* Time                                                             */
/* ---------------------------------------------------------------- */

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

/* ---------------------------------------------------------------- */
/* Slips                                                            */
/* ---------------------------------------------------------------- */

/**
 * Put one note at the corner of the desk.
 * A note with the tone "bad" stays until the operator dismisses it. Every
 * other note goes away by itself.
 */
function slip(title, message, tone = "ok") {
  const node = document.createElement("div");
  node.className = "slip";
  node.dataset.tone = tone;
  node.setAttribute("role", tone === "bad" ? "alert" : "status");

  const head = document.createElement("b");
  head.textContent = title;
  const text = document.createElement("span");
  text.textContent = message;
  node.append(head, text);

  const close = document.createElement("button");
  close.className = "btn btn--ghost";
  close.type = "button";
  close.style.marginTop = "0.5rem";
  close.textContent = "Dismiss";
  close.addEventListener("click", () => node.remove());
  node.append(close);

  el.slips.append(node);
  if (tone !== "bad") setTimeout(() => node.remove(), 9000);
}

/* ---------------------------------------------------------------- */
/* Health                                                           */
/* ---------------------------------------------------------------- */

async function loadHealth() {
  try {
    const health = await api("/healthz");
    el.health.model.textContent = health.model;
    el.colophonModel.textContent = health.model;
    el.health.route.textContent = health.use_vertex_ai ? "Vertex AI" : "Gemini API";
    el.health.status.textContent = "up";
    el.health.status.dataset.ok = "yes";

    const missing = health.missing_config || [];
    if (missing.length) {
      el.configStrip.hidden = false;
      el.configStrip.textContent =
        `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} not set. ` +
        "Phase 1 still runs. The commits on approval need these values.";
    }
  } catch (error) {
    el.health.status.textContent = "unreachable";
    el.health.status.dataset.ok = "no";
    slip("Service", `The health check failed. ${error.message}`, "bad");
  }
}

/* ---------------------------------------------------------------- */
/* The ledger of the six nodes                                      */
/* ---------------------------------------------------------------- */

const NODE_ORDER = ["scan", "extract", "rules", "generate", "evaluate", "persist"];

const FAILED_AT = {
  FAILED_SCAN: "scan",
  FAILED_EXTRACTION: "extract",
  FAILED_GENERATION: "generate",
};

/**
 * Read the row and say which nodes reported.
 * A line is marked only when its output is in the row. The row carries no
 * per-node log, so this is evidence and not a progress bar.
 */
function ledgerStates(tx) {
  if (!tx) return {};

  const done = {
    scan: Boolean(tx.metadata),
    extract: Boolean(tx.metadata),
    rules: Boolean(tx.assets),
    generate: Boolean(tx.assets),
    evaluate: Boolean(tx.recommendation),
    persist: tx.status !== "RUNNING" && !String(tx.status).startsWith("FAILED"),
  };

  const failedNode = FAILED_AT[tx.status] || null;
  const result = {};
  let activeTaken = false;

  for (const node of NODE_ORDER) {
    if (failedNode) {
      const stopped = NODE_ORDER.indexOf(failedNode);
      const here = NODE_ORDER.indexOf(node);
      result[node] = here < stopped ? "done" : here === stopped ? "failed" : "idle";
      continue;
    }
    if (done[node]) {
      result[node] = "done";
    } else if (!activeTaken && tx.status === "RUNNING") {
      result[node] = "active";
      activeTaken = true;
    } else {
      result[node] = "idle";
    }
  }
  return result;
}

function renderLedger(tx) {
  const states = ledgerStates(tx);
  for (const line of el.ledger.querySelectorAll("li")) {
    line.dataset.state = states[line.dataset.node] || "idle";
  }
}

function resetLedger() {
  for (const line of el.ledger.querySelectorAll("li")) line.dataset.state = "idle";
}

/* ---------------------------------------------------------------- */
/* The stamp                                                        */
/* ---------------------------------------------------------------- */

const STAMP_TEXT = {
  FULL_PUBLISH: ["Full publish", "gate · passed"],
  PRIVATE_ONLY: ["Private only", "gate · held"],
  PENDING_APPROVAL: ["Awaiting you", "no commit yet"],
  COMPLETED: ["Committed", "closed loop"],
  PARTIAL: ["Part committed", "one side failed"],
  REJECTED: ["Discarded", "by the operator"],
  FAILED_SCAN: ["Scan failed", "step one"],
  FAILED_EXTRACTION: ["Extract failed", "step two"],
  FAILED_GENERATION: ["Write failed", "step four"],
};

/**
 * Put the verdict on the paper.
 * The stamp lands one time for each verdict. A poll that finds the same
 * verdict again does not make it land again.
 */
function renderStamp(tx) {
  if (!tx) {
    el.stamp.dataset.verdict = "";
    el.stamp.removeAttribute("data-land");
    state.stamped = "";
    return;
  }

  // The gate reads before the row status, because the gate is the decision.
  let key = tx.status;
  if (tx.status === "PENDING_APPROVAL" && tx.recommendation) {
    key = tx.recommendation.recommendation;
  }

  const [text, sub] = STAMP_TEXT[key] || [String(key).replace(/_/g, " "), "row status"];
  el.stamp.querySelector(".stamp__text").textContent = text;
  el.stamp.querySelector(".stamp__sub").textContent = sub;
  el.stamp.dataset.verdict = key;

  if (state.stamped !== key) {
    el.stamp.removeAttribute("data-land");
    void el.stamp.offsetWidth; // restart the animation
    el.stamp.dataset.land = "yes";
    state.stamped = key;
  }
}

/* ---------------------------------------------------------------- */
/* The sheet                                                        */
/* ---------------------------------------------------------------- */

function fact(term, value, href) {
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

function listItems(target, items) {
  target.replaceChildren();
  for (const item of items || []) {
    const li = document.createElement("li");
    li.textContent = item;
    target.append(li);
  }
}

function renderSheet(tx) {
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

function renderFolios(tx, fresh = false) {
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
  if (tx.card_commit_sha) {
    el.receipts.append(fact("Portfolio card commit", tx.card_commit_sha.slice(0, 12)));
  }
  if (tx.completed_at) {
    el.receipts.append(fact("Closed", when(tx.completed_at)));
  }
}

/* ---------------------------------------------------------------- */
/* The meters below each folio                                      */
/* ---------------------------------------------------------------- */

function measureAll() {
  const words = folio.doc.box.value.trim().split(/\s+/).filter(Boolean).length;
  folio.doc.meter.textContent = `${words} words · markdown`;
  folio.doc.meter.dataset.warn = folio.doc.box.value.trim() ? "no" : "yes";

  const card = readCard();
  folio.card.meter.textContent = card.ok
    ? `valid JSON · ${Object.keys(card.value).length} keys`
    : `not valid JSON — ${card.error}`;
  folio.card.meter.dataset.warn = card.ok ? "no" : "yes";

  const bullets = readBullets();
  folio.bullets.meter.textContent = `${bullets.length} ${bullets.length === 1 ? "line" : "lines"}`;
  folio.bullets.meter.dataset.warn = bullets.length ? "no" : "yes";

  const chars = folio.social.box.value.length;
  folio.social.meter.textContent = `${chars} characters · ${POST_LIMIT} is one post`;
  folio.social.meter.dataset.warn = chars > POST_LIMIT ? "yes" : "no";
}

function readCard() {
  const raw = folio.card.box.value.trim();
  if (!raw) return { ok: true, value: {} };
  try {
    const value = JSON.parse(raw);
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, error: "the card must be a JSON object" };
    }
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

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
function collectEdits() {
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
/* Polling                                                          */
/* ---------------------------------------------------------------- */

function stopPolling() {
  if (state.timer) clearTimeout(state.timer);
  state.timer = null;
}

async function pollOnce(txId) {
  state.polls += 1;
  let tx;
  try {
    tx = await api(`/api/v1/transactions/${encodeURIComponent(txId)}`);
  } catch (error) {
    el.poll.textContent = `The poll failed. ${error.message}`;
    stopPolling();
    slip("Poll", error.message, "bad");
    return;
  }

  state.tx = tx;
  renderLedger(tx);
  renderSheet(tx);

  if (tx.status === "RUNNING") {
    if (state.polls >= POLL_LIMIT) {
      el.poll.textContent =
        `The row is still RUNNING after ${state.polls} checks. The poll stopped. ` +
        "Reload the page to look again.";
      stopPolling();
      return;
    }
    el.poll.textContent = `Running · ${state.polls} ${state.polls === 1 ? "check" : "checks"} · the first unmarked line is where the run is, or just before it.`;
    state.timer = setTimeout(() => pollOnce(txId), POLL_MS);
    return;
  }

  stopPolling();
  el.poll.textContent = `The run stopped at ${String(tx.status).replace(/_/g, " ")} after ${state.polls} ${state.polls === 1 ? "check" : "checks"}.`;

  if (tx.status === "PENDING_APPROVAL") {
    el.sheet.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (String(tx.status).startsWith("FAILED")) {
    slip("The run failed", tx.error_message || String(tx.status), "bad");
  }
}

function openRecord(txId) {
  stopPolling();
  state.polls = 0;
  state.stamped = "";
  resetLedger();
  localStorage.setItem("ps.tx", txId);
  el.txid.textContent = txId;
  el.poll.textContent = "Opened. The first check follows.";
  pollOnce(txId);
}

/* ---------------------------------------------------------------- */
/* Actions                                                          */
/* ---------------------------------------------------------------- */

el.intake.addEventListener("submit", async (event) => {
  event.preventDefault();
  el.intakeError.hidden = true;

  const repoUrl = el.repoUrl.value.trim();
  if (!/^https?:\/\/(www\.)?github\.com\/[^/\s]+\/[^/\s]+/.test(repoUrl)) {
    el.intakeError.hidden = false;
    el.intakeError.textContent =
      "Give a GitHub repository URL, in the form https://github.com/owner/name.";
    el.repoUrl.focus();
    return;
  }

  const userId = el.userId.value.trim() || "default";
  localStorage.setItem("ps.user", userId);

  const payload = { repo_url: repoUrl, user_id: userId };
  const commit = el.commitSha.value.trim();
  if (commit) payload.commit_sha = commit;

  el.begin.disabled = true;
  el.begin.querySelector("span").textContent = "Opening…";
  try {
    const answer = await postJson("/api/v1/trigger-sync", payload);
    openRecord(answer.transaction_id);
    await loadRules(userId);
  } catch (error) {
    el.intakeError.hidden = false;
    el.intakeError.textContent = error.message;
  } finally {
    el.begin.disabled = false;
    el.begin.querySelector("span").textContent = "Open a record";
  }
});

el.regenerate.addEventListener("click", async () => {
  if (!state.tx) return;
  el.regenerate.disabled = true;
  const label = el.regenerate.textContent;
  el.regenerate.textContent = "Writing…";
  try {
    const answer = await postJson("/api/v1/regenerate-asset", {
      transaction_id: state.tx.tx_id,
    });
    state.tx.assets = answer.assets;
    state.tx.style_rules_applied = (state.rules || [])
      .filter((rule) => rule.state === "ACTIVE")
      .map((rule) => rule.rule_id);
    renderFolios(state.tx, true);
    const count = (answer.style_rules_applied || []).length;
    slip(
      "Written again",
      count
        ? `${count} active ${count === 1 ? "rule" : "rules"} shaped this draft.`
        : "No rule is active, so this draft had none to obey.",
      count ? "ok" : "warn",
    );
  } catch (error) {
    slip("Write again failed", error.message, "bad");
  } finally {
    el.regenerate.disabled = false;
    el.regenerate.textContent = label;
  }
});

el.approve.addEventListener("click", async () => {
  if (!state.tx) return;
  const edits = collectEdits();
  if (edits === null) return;

  // Ask first. This action writes two commits to two repositories, and a commit
  // is not easy to take back. The discard action asks, so the action that writes
  // must ask too.
  const target = state.tx.repo_name;
  const question =
    `Commit for ${target}?\n\n` +
    "· The documentation sheet goes to docs/synced/ in that repository.\n" +
    "· The portfolio card goes to your private portfolio repository.\n\n" +
    "Both are real commits. The resume lines and the social post stay here.";
  if (!confirm(question)) return;

  el.approve.disabled = true;
  el.approve.textContent = "Committing…";
  try {
    const answer = await postJson("/api/v1/approval-callback", {
      transaction_id: state.tx.tx_id,
      approved: true,
      edited_assets: edits,
    });

    if (answer.status === "COMPLETED") {
      slip("Both commits landed", "The loop is closed. The receipts are on the sheet.", "ok");
    } else {
      slip(
        "One commit failed",
        answer.doc_error || answer.card_error || "The row is PARTIAL. Approve again to retry.",
        "warn",
      );
    }
    for (const rule of answer.proposed_rules || []) {
      slip("The curator proposes a rule", rule, "ok");
    }
    await loadRules(state.tx.user_id);
    await pollOnce(state.tx.tx_id);
  } catch (error) {
    slip("The approval failed", error.message, "bad");
  } finally {
    el.approve.disabled = false;
    el.approve.textContent = "Approve and commit";
  }
});

el.discard.addEventListener("click", async () => {
  if (!state.tx) return;
  const name = (state.tx.metadata && state.tx.metadata.project_name) || state.tx.repo_name;
  if (!confirm(`Discard the four drafts for ${name}? Nothing commits, and the row closes as rejected.`)) {
    return;
  }
  el.discard.disabled = true;
  try {
    await postJson("/api/v1/approval-callback", {
      transaction_id: state.tx.tx_id,
      approved: false,
    });
    slip("Discarded", "The row is rejected. No commit was written.", "warn");
    await pollOnce(state.tx.tx_id);
  } catch (error) {
    slip("The discard failed", error.message, "bad");
  } finally {
    el.discard.disabled = false;
  }
});

/* --- Copy buttons -------------------------------------------------- */

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-copy]");
  if (!button) return;
  const box = document.getElementById(button.dataset.copy);
  try {
    await navigator.clipboard.writeText(box.value);
    const label = button.textContent;
    button.textContent = "Copied";
    setTimeout(() => (button.textContent = label), 1400);
  } catch {
    box.select();
    slip("Copy", "The browser refused the clipboard. The text is selected.", "warn");
  }
});

/* --- The meters follow every keystroke ----------------------------- */

for (const part of Object.values(folio)) {
  part.box.addEventListener("input", () => {
    autosize(part.box);
    measureAll();
  });
}

/* ---------------------------------------------------------------- */
/* The voice rules                                                  */
/* ---------------------------------------------------------------- */

const NEXT_STATE = { PROPOSED: "ACTIVE", INACTIVE: "ACTIVE", ACTIVE: "INACTIVE" };
const TOGGLE_LABEL = { PROPOSED: "Turn on", INACTIVE: "Turn on", ACTIVE: "Turn off" };

async function loadRules(userId) {
  const owner = userId || el.userId.value.trim() || "default";
  try {
    state.rules = await api(`/api/v1/rules?user_id=${encodeURIComponent(owner)}`);
  } catch (error) {
    el.rules.replaceChildren();
    const li = document.createElement("li");
    li.className = "rules__empty";
    li.textContent = `The rules did not load. ${error.message}`;
    el.rules.append(li);
    return;
  }
  renderRules();
}

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
    li.dataset.state = rule.state;

    const left = document.createElement("div");
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

    li.append(left, button);
    el.rules.append(li);
  }
}

async function setRuleState(rule) {
  const next = NEXT_STATE[rule.state] || "ACTIVE";
  try {
    await postJson(`/api/v1/rules/${encodeURIComponent(rule.rule_id)}`, { state: next });
    rule.state = next;
    renderRules();
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

/* ---------------------------------------------------------------- */
/* Boot                                                             */
/* ---------------------------------------------------------------- */

async function boot() {
  const savedUser = localStorage.getItem("ps.user");
  if (savedUser) el.userId.value = savedUser;

  await loadHealth();
  await loadRules(el.userId.value.trim() || "default");

  // A reload must not lose the record that is open.
  const savedTx = localStorage.getItem("ps.tx");
  if (savedTx) {
    el.poll.textContent = "Reading the record that was open.";
    try {
      const tx = await api(`/api/v1/transactions/${encodeURIComponent(savedTx)}`);
      state.tx = tx;
      renderLedger(tx);
      renderSheet(tx);
      if (tx.status === "RUNNING") {
        openRecord(savedTx);
      } else {
        el.poll.textContent = `The last record stopped at ${String(tx.status).replace(/_/g, " ")}.`;
      }
    } catch {
      localStorage.removeItem("ps.tx");
      el.poll.textContent = "No record open.";
    }
  }
}

boot();
