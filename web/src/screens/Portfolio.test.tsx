import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Portfolio } from "./Portfolio";

/**
 * The gallery.
 *
 * The tests are the promise of stage F6. A card is on the screen for work that a
 * person approved and for nothing else, the filter and the sort agree with the
 * choice, and the deck can be walked from the keyboard alone, because a swipe by
 * itself is not a control that everybody can use.
 */

function card(title: string, stack: string[]) {
  return {
    title,
    tagline: `One line about ${title}.`,
    stack,
    highlights: [`${title} works.`],
    repo_url: `https://github.com/owner/${title.toLowerCase()}`,
  };
}

function row(txId: string, status: string, made: ReturnType<typeof card> | null) {
  const assets =
    made === null
      ? null
      : {
          doc_sheet_md: "# A sheet",
          portfolio_card: made,
          resume_bullets: ["It works."],
          social_draft: "A post.",
        };
  return {
    tx_id: txId,
    user_id: "default",
    repo_url: "https://github.com/owner/name",
    repo_name: `owner/${txId}`,
    status,
    metadata: null,
    asset_versions: assets === null ? [] : [{ version: 1, source: "GENERATED", assets }],
    recommendation: null,
    style_rules_applied: [],
    approval_token: null,
    doc_commit_sha: null,
    card_commit_sha: null,
    error_message: null,
    created_at: "2026-08-22T10:00:00Z",
    completed_at: null,
    assets,
  };
}

/** The history, newest first, as the service answers it. */
const HISTORY = [
  row("tx-1", "COMPLETED", card("Beacon", ["Python", "FastAPI"])),
  row("tx-2", "PARTIAL", card("Atlas", ["React"])),
  row("tx-3", "PENDING_APPROVAL", card("Waiting", ["Go"])),
  row("tx-4", "COMPLETED", null),
];

const asked: string[] = [];

function stub(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      asked.push(String(input));
      return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

/** The titles that are on the screen, in the order they are drawn. */
function titles(): string[] {
  return screen
    .getAllByRole("heading", { level: 3 })
    .map((one) => one.textContent ?? "");
}

beforeEach(() => {
  asked.length = 0;
  // The test environment has no canvas. Saying so here keeps the report clean and
  // it is the same answer that an old browser gives.
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    value: () => null,
    writable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("shows a card for each run that a person approved, and for nothing else", async () => {
  stub(HISTORY);
  render(<Portfolio />);

  expect(await screen.findByText("Beacon")).toBeInTheDocument();
  expect(screen.getByText("Atlas")).toBeInTheDocument();
  // A run that still waits for a person is not finished work, and a run whose
  // version holds no card has nothing to draw.
  expect(screen.queryByText("Waiting")).not.toBeInTheDocument();
  expect(titles()).toHaveLength(2);
});

it("reads the history one time and takes no status", async () => {
  stub(HISTORY);
  render(<Portfolio />);
  await screen.findByText("Beacon");

  const reads = asked.filter((one) => one.includes("/transactions"));
  expect(reads).toHaveLength(1);
  expect(reads[0]).toContain("user_id=default");
  expect(reads[0]).not.toContain("status=");
});

it("keeps only the cards that are built with the chosen thing", async () => {
  stub(HISTORY);
  render(<Portfolio />);
  await screen.findByText("Beacon");

  await userEvent.click(screen.getByRole("button", { name: "React" }));
  expect(titles()).toEqual(["Atlas"]);

  await userEvent.click(screen.getByRole("button", { name: "Everything" }));
  expect(titles()).toHaveLength(2);
});

it("orders the cards by name when it is asked to", async () => {
  stub(HISTORY);
  render(<Portfolio />);
  await screen.findByText("Beacon");

  // The service answers newest first, and that is the order it arrives in.
  expect(titles()).toEqual(["Beacon", "Atlas"]);
  await userEvent.selectOptions(screen.getByRole("combobox"), "name");
  expect(titles()).toEqual(["Atlas", "Beacon"]);
});

it("takes every card into the deck until a person chooses one", async () => {
  stub(HISTORY);
  render(<Portfolio />);
  await screen.findByText("Beacon");

  expect(screen.getByText("The deck takes all 2")).toBeInTheDocument();
  await userEvent.click(screen.getAllByRole("button", { name: "Choose" })[0]);
  expect(screen.getByText("The deck takes the 1 you chose")).toBeInTheDocument();
});

it("drops a card from the choice when the filter hides it", async () => {
  stub(HISTORY);
  render(<Portfolio />);
  await screen.findByText("Beacon");

  await userEvent.click(screen.getAllByRole("button", { name: "Choose" })[0]);
  expect(screen.getByText("The deck takes the 1 you chose")).toBeInTheDocument();

  // Beacon is not built with React, so the choice cannot hold it any more.
  await userEvent.click(screen.getByRole("button", { name: "React" }));
  expect(screen.getByText("The deck takes all 1")).toBeInTheDocument();
});

it("walks the deck from the keyboard and keeps what the arrows keep", async () => {
  stub(HISTORY);
  render(<Portfolio />);
  await screen.findByText("Beacon");

  await userEvent.click(screen.getByRole("button", { name: "Build a deck" }));
  const sheet = screen.getByRole("dialog");
  expect(sheet).toHaveTextContent("Card 1 of 2");

  await userEvent.keyboard("{ArrowRight}");
  expect(sheet).toHaveTextContent("Card 2 of 2");

  await userEvent.keyboard("{ArrowLeft}");
  expect(sheet).toHaveTextContent("One card is in the deck.");

  // No canvas here, so the picture cannot be made and the paper is the way out.
  await waitFor(() => {
    expect(sheet).toHaveTextContent("use the print page");
  });
});

it("closes the deck on Escape", async () => {
  stub(HISTORY);
  render(<Portfolio />);
  await screen.findByText("Beacon");

  await userEvent.click(screen.getByRole("button", { name: "Build a deck" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();

  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("says so when no run is approved yet", async () => {
  stub([]);
  render(<Portfolio />);

  expect(await screen.findByText("No card yet")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Build a deck" })).toBeDisabled();
});

it("reports the words of the service when the read fails", async () => {
  stub({ detail: "The database did not answer." }, 500);
  render(<Portfolio />);

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "The database did not answer.",
  );
});
