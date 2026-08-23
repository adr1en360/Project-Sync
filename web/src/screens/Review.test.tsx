import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Review } from "./Review";

/**
 * The gate.
 *
 * The tests are the promise of stage F5. A fixture run goes from waiting to
 * committed inside the interface, what a person typed is what the service
 * receives, an edit becomes a rule, and no control that the service would answer
 * with 409 is ever on the screen.
 */

const ASSETS = {
  doc_sheet_md: "# A sheet",
  portfolio_card: {
    title: "A project",
    tagline: "One line about it.",
    stack: ["Python"],
    highlights: ["It works."],
    repo_url: "https://github.com/owner/name",
  },
  resume_bullets: ["Built the thing."],
  social_draft: "A post about it.",
};

const VERDICT = {
  recommendation: "PRIVATE_ONLY",
  reasons: ["The readme names a key."],
  missing_elements: ["A licence"],
  confidence: 0.82,
};

const RULE = {
  rule_id: "rule-1",
  text: "Write in the first person.",
  state: "INACTIVE",
  source: "CURATOR",
  source_transaction_id: "tx-1",
  created_at: "2026-08-22T10:00:00Z",
  updated_at: "2026-08-22T10:00:00Z",
};

const COMMITTED = {
  status: "COMPLETED",
  doc_commit_sha: "fixture-doc-a-project",
  card_commit_sha: "fixture-card-a-project",
  doc_error: null,
  card_error: null,
  proposed_rules: ["Keep the tagline to one line."],
};

function row(status: string, extra: Record<string, unknown> = {}) {
  return {
    tx_id: "tx-1",
    user_id: "default",
    repo_url: "https://github.com/owner/name",
    repo_name: "owner/name",
    status,
    metadata: null,
    asset_versions: [{ version: 1, source: "GENERATED", assets: ASSETS }],
    recommendation: VERDICT,
    style_rules_applied: ["rule-1"],
    approval_token: null,
    doc_commit_sha: null,
    card_commit_sha: null,
    error_message: null,
    created_at: "2026-08-22T10:00:00Z",
    completed_at: null,
    assets: ASSETS,
    ...extra,
  };
}

const calls: { url: string; body: unknown }[] = [];

/**
 * Answer each address with its own body, and keep every request.
 *
 * The first key that the address holds wins, so `/events` goes before
 * `/transactions/tx-1`, because the address of the log holds both.
 */
function stub(map: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const address = String(input);
      const raw = init?.body;
      calls.push({ url: address, body: typeof raw === "string" ? JSON.parse(raw) : null });
      const key = Object.keys(map).find((path) => address.includes(path));
      return new Response(JSON.stringify(key === undefined ? {} : map[key]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

function sentTo(path: string): Record<string, unknown> | null {
  const call = calls.find((one) => one.url.includes(path) && one.body !== null);
  return (call?.body ?? null) as Record<string, unknown> | null;
}

function desk(status: string, extra: Record<string, unknown> = {}, rules: unknown[] = []) {
  stub({
    "/events": [],
    "/approval-callback": COMMITTED,
    "/transactions/tx-1": row(status, extra),
    "/rules": rules,
  });
  render(<Review txId="tx-1" />);
}

beforeEach(() => {
  calls.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("shows the verdict, the four drafts and the two controls of a decision", async () => {
  desk("PENDING_APPROVAL");

  // The verdict is a word and a mark, and never a colour by itself.
  expect(await screen.findByText("Keep this one private")).toBeInTheDocument();
  expect(screen.getByText("The readme names a key.")).toBeInTheDocument();
  expect(screen.getByText(/Confidence 82 of 100/)).toBeInTheDocument();

  // The four drafts, each one open to a change.
  expect(screen.getByLabelText("The sheet")).toHaveValue("# A sheet");
  expect(screen.getByLabelText("Title")).toHaveValue("A project");
  expect(screen.getByLabelText("Bullets")).toHaveValue("Built the thing.");
  expect(screen.getByLabelText("The post")).toHaveValue("A post about it.");

  expect(screen.getByRole("button", { name: "Approve and publish" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Reject" })).toBeEnabled();
});

it("sends no edit when a person changed nothing", async () => {
  const person = userEvent.setup();
  desk("PENDING_APPROVAL");

  await person.click(await screen.findByRole("button", { name: "Approve and publish" }));

  // A version marked as a human edit for a draft that no human touched would
  // teach the curator a voice that nobody has.
  await waitFor(() => expect(sentTo("/approval-callback")).not.toBeNull());
  expect(sentTo("/approval-callback")).toMatchObject({
    transaction_id: "tx-1",
    approved: true,
    edited_assets: null,
  });
});

it("sends what a person typed, and then shows the two commits", async () => {
  const person = userEvent.setup();
  desk("PENDING_APPROVAL");

  const post = await screen.findByLabelText("The post");
  await person.clear(post);
  await person.type(post, "My own words.");
  await person.click(screen.getByRole("button", { name: "Approve and publish" }));

  await waitFor(() => expect(sentTo("/approval-callback")).not.toBeNull());
  const sent = sentTo("/approval-callback");
  expect(sent).toMatchObject({ approved: true });
  expect(sent?.edited_assets).toMatchObject({
    social_draft: "My own words.",
    // The lists went out as text and came back as lists.
    resume_bullets: ["Built the thing."],
    portfolio_card: { stack: ["Python"] },
  });

  // The receipt is the answer of the service and not a guess of the client.
  expect(await screen.findByText("fixture-doc-a-project")).toBeInTheDocument();
  expect(screen.getByText("fixture-card-a-project")).toBeInTheDocument();
  expect(screen.getByText("Keep the tagline to one line.")).toBeInTheDocument();
});

it("rejects with no drafts at all", async () => {
  const person = userEvent.setup();
  desk("PENDING_APPROVAL");

  await person.click(await screen.findByRole("button", { name: "Reject" }));

  await waitFor(() => expect(sentTo("/approval-callback")).not.toBeNull());
  expect(sentTo("/approval-callback")).toMatchObject({
    approved: false,
    edited_assets: null,
  });
});

it("offers no decision once the run is past the gate", async () => {
  desk("COMPLETED");

  // The service holds no gate on the status, so this screen is the gate. A second
  // approval would write the two commits again.
  expect(await screen.findByLabelText("The post")).toHaveAttribute("readonly");
  expect(screen.queryByRole("button", { name: "Approve and publish" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
});

it("offers a retry when one commit landed and the other did not", async () => {
  desk("PARTIAL", { doc_commit_sha: "abc1234" });

  expect(
    await screen.findByRole("button", { name: "Try the commits again" }),
  ).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Approve and publish" })).toBeNull();
});

it("says so when a run wrote no drafts, and offers no decision", async () => {
  desk("FAILED_GENERATION", {
    assets: null,
    asset_versions: [],
    error_message: "The model gave nothing back.",
  });

  expect(await screen.findByText("The model gave nothing back.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Approve and publish" })).toBeNull();
});

it("shows the rules of the person and marks the ones this run used", async () => {
  desk("PENDING_APPROVAL", {}, [RULE]);

  expect(await screen.findByText("Write in the first person.")).toBeInTheDocument();
  expect(screen.getByText("Used in this run")).toBeInTheDocument();
  expect(screen.getByRole("switch", { name: /This rule is off/ })).toBeInTheDocument();
});

it("turns one rule on", async () => {
  const person = userEvent.setup();
  desk("PENDING_APPROVAL", {}, [RULE]);

  await person.click(await screen.findByRole("switch", { name: /Press to turn it on/ }));

  await waitFor(() => expect(sentTo("/rules/rule-1")).not.toBeNull());
  expect(sentTo("/rules/rule-1")).toMatchObject({ state: "ACTIVE" });
});

it("keeps what a person writes as a rule", async () => {
  const person = userEvent.setup();
  desk("PENDING_APPROVAL");

  const add = await screen.findByRole("button", { name: "Add the rule" });
  // An empty rule is not a rule, so the control waits for a sentence.
  expect(add).toBeDisabled();

  await person.type(screen.getByLabelText("Keep this as a rule"), "Say it in one line.");
  await person.click(add);

  await waitFor(() => expect(sentTo("/rules")).not.toBeNull());
  expect(sentTo("/rules")).toMatchObject({
    user_id: "default",
    text: "Say it in one line.",
  });
});

it("holds no draft of a run that the address does not name", async () => {
  render(<Review txId={null} />);

  expect(screen.getByText("No run is waiting")).toBeInTheDocument();
  expect(screen.queryByLabelText("The post")).toBeNull();
});
