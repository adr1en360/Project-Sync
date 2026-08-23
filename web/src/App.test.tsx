import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import { NODE_ORDER } from "./labels";
import { TABS } from "./nav";

/**
 * The shell.
 *
 * The tests are the promise of stage F3: every screen opens, the theme moves
 * through the three modes, the accent menu changes the hue and answers the
 * keyboard, the run screen shows the name of each node and no other screen
 * offers that control, and the choices come back after a reload.
 */

const OK = {
  status: "ok",
  model: "gemini-3.5-flash",
  use_vertex_ai: true,
  fixture_mode: false,
  missing_config: [],
};

/** A row that is finished, so the run screen does not poll again. */
const ROW = {
  tx_id: "tx-1",
  user_id: "default",
  repo_url: "https://github.com/owner/name",
  repo_name: "owner/name",
  status: "PENDING_APPROVAL",
  metadata: null,
  asset_versions: [],
  recommendation: null,
  style_rules_applied: [],
  approval_token: null,
  doc_commit_sha: null,
  card_commit_sha: null,
  error_message: null,
  created_at: "2026-08-22T10:00:00Z",
  completed_at: "2026-08-22T10:00:20Z",
  assets: null,
};

/**
 * Give a stub of `fetch` that answers each path with its own body.
 *
 * The first key that the address holds wins, so a key that is part of another
 * key goes first. `/events` goes before `/transactions/tx-1`, because the
 * address of the log holds both.
 */
function stubRoutes(map: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const address = String(input);
      const key = Object.keys(map).find((path) => address.includes(path));
      return new Response(JSON.stringify(key === undefined ? {} : map[key]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

/** Give a stub of `fetch` that answers with one body and one status. */
function stubFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
    ),
  );
}

beforeEach(() => {
  window.localStorage.clear();
  // `replaceState` writes the address and makes no `hashchange` event, so one
  // test cannot move the screen of the next one.
  window.history.replaceState(null, "", "/");
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-hue");
  // The review desk reads the rules of the person, so an answer that holds one
  // object for every address would give the list of rules a health report. The
  // test said the wrong thing about the service, so the test is what changes.
  stubRoutes({ "/rules": [], "/transactions": [], "/healthz": OK });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function tabControl(label: string) {
  return screen.getByRole("button", { name: new RegExp(label) });
}

/** The control of the run screen. It must exist on that screen only. */
function showMore() {
  return screen.queryByRole("button", { name: "Show more" });
}

it("opens every screen", async () => {
  const person = userEvent.setup();
  render(<App />);

  for (const tab of TABS) {
    await person.click(tabControl(tab.label));

    await waitFor(() => {
      expect(tabControl(tab.label)).toHaveAttribute("aria-current", "page");
    });
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(window.location.hash).toBe(`#/${tab.id}`);
  }
});

it("opens the screen that the address names", () => {
  window.history.replaceState(null, "", "/#/review");

  render(<App />);

  expect(tabControl("Review")).toHaveAttribute("aria-current", "page");
});

it("moves the theme through the three modes", async () => {
  const person = userEvent.setup();
  render(<App />);
  const control = () => screen.getByRole("button", { name: /^Theme/ });

  expect(document.documentElement.hasAttribute("data-theme")).toBe(false);

  await person.click(control());
  expect(document.documentElement.getAttribute("data-theme")).toBe("light");

  await person.click(control());
  expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

  // The third press returns to the wish of the machine, and then the attribute
  // is gone so the media query answers.
  await person.click(control());
  expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
});

/** The button of the accent menu. Its name carries the value that is on. */
function accentMenu(current: string) {
  return screen.getByRole("button", { name: `Accent colour: ${current}` });
}

it("changes the hue with the accent menu", async () => {
  const person = userEvent.setup();
  render(<App />);

  await person.click(accentMenu("Azure"));
  await person.click(screen.getByRole("menuitemradio", { name: "Rose" }));

  expect(document.documentElement.getAttribute("data-hue")).toBe("rose");
  // The menu closes after a choice, and the button now names Rose.
  expect(screen.queryByRole("menu")).toBeNull();
  expect(accentMenu("Rose")).toBeInTheDocument();

  // Azure is the value of the token file, so it writes no attribute.
  await person.click(accentMenu("Rose"));
  await person.click(screen.getByRole("menuitemradio", { name: "Azure" }));
  expect(document.documentElement.hasAttribute("data-hue")).toBe(false);
});

it("closes the accent menu with Esc and gives the focus back", async () => {
  const person = userEvent.setup();
  render(<App />);
  const opener = accentMenu("Azure");

  await person.click(opener);
  expect(screen.getByRole("menu")).toBeInTheDocument();

  await person.keyboard("{Escape}");

  expect(screen.queryByRole("menu")).toBeNull();
  expect(opener).toHaveFocus();
});

it("offers the Show more control on the run screen only", async () => {
  const person = userEvent.setup();
  render(<App />);

  // Intake is the first screen, and it has no detail to show.
  expect(showMore()).toBeNull();

  await person.click(tabControl("Run"));
  expect(showMore()).toBeInTheDocument();

  await person.click(tabControl("Library"));
  expect(showMore()).toBeNull();
});

it("shows the name of each node when Show more is on", async () => {
  const person = userEvent.setup();
  render(<App />);

  await person.click(tabControl("Run"));

  // The name is in the page and the reveal is shut, so nothing reads it.
  const reveal = () =>
    screen.getByText("scan_github_repository").closest(".reveal");
  expect(reveal()).toHaveAttribute("aria-hidden", "true");

  const control = showMore();
  if (control === null) {
    throw new Error("The run screen must hold the Show more control.");
  }
  await person.click(control);

  expect(reveal()).not.toHaveAttribute("aria-hidden");
  expect(screen.getByText("persist_transaction")).toBeInTheDocument();
});

it("keeps the choices after a reload", async () => {
  const person = userEvent.setup();
  window.localStorage.setItem("projectsync.mode", "dark");
  window.localStorage.setItem("projectsync.hue", "rose");
  window.localStorage.setItem("projectsync.showmore", "on");

  render(<App />);

  expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  expect(document.documentElement.getAttribute("data-hue")).toBe("rose");

  await person.click(tabControl("Run"));
  expect(showMore()).toHaveAttribute("aria-pressed", "true");
  expect(
    screen.getByText("scan_github_repository").closest(".reveal"),
  ).not.toHaveAttribute("aria-hidden");
});

it("shows the detail text when the service refuses", async () => {
  stubFetch({ detail: "Firestore refused the connection." }, 503);

  render(<App />);

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Firestore refused the connection.",
  );
});
it("shows a badge when a run costs no model call", async () => {
  stubFetch({ ...OK, fixture_mode: true });

  render(<App />);

  expect(await screen.findByText("No model calls")).toBeInTheDocument();
});

it("shows no badge when the service calls the model", async () => {
  render(<App />);

  // The head is on the screen, so the answer of the service has arrived.
  expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.queryByText("No model calls")).toBeNull();
  });
});

it("opens the run screen when the service accepts a repository", async () => {
  const person = userEvent.setup();
  stubRoutes({
    "/healthz": OK,
    "/trigger-sync": { transaction_id: "tx-1", status: "RUNNING" },
    "/events": [],
    "/transactions/tx-1": { ...ROW, status: "RUNNING" },
  });

  render(<App />);

  await person.type(screen.getByLabelText("Owner and name"), "owner/name");
  await person.click(screen.getByRole("button", { name: "Read the repository" }));

  // The move is automatic, so the address changes and the region says so.
  await waitFor(() => {
    expect(window.location.hash).toBe("#/run/tx-1");
  });
  expect(tabControl("Run")).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("status")).toHaveTextContent(
    "The service accepted the repository.",
  );

  // The id of the transaction and the state of the row are both on the screen.
  expect(await screen.findByText("tx-1")).toBeInTheDocument();
  expect(screen.getByText("Running")).toBeInTheDocument();
});

it("says what the service refused and stays on the intake screen", async () => {
  const person = userEvent.setup();
  stubRoutes({ "/healthz": OK });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const address = String(input);
      const refused = address.includes("/trigger-sync");
      return new Response(
        JSON.stringify(refused ? { detail: "That is not a GitHub repository." } : OK),
        {
          status: refused ? 400 : 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }),
  );

  render(<App />);

  await person.type(screen.getByLabelText("Owner and name"), "not a repo");
  await person.click(screen.getByRole("button", { name: "Read the repository" }));

  expect(await screen.findByText("That is not a GitHub repository.")).toBeInTheDocument();
  expect(window.location.hash).not.toContain("run");
});

it("offers no control that the service would refuse", async () => {
  const person = userEvent.setup();
  stubRoutes({
    "/healthz": OK,
    "/events": [],
    // A row that waits for a person can neither be stopped nor run again.
    "/transactions/tx-1": ROW,
  });
  window.history.replaceState(null, "", "/#/run/tx-1");

  render(<App />);

  expect(await screen.findByText("Waiting for you")).toBeInTheDocument();
  expect(screen.getByText("tx-1")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Stop the run/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /Run it again/ })).toBeNull();

  // The end of a run is a change that a person did not ask for, so it is said.
  await waitFor(() => {
    expect(screen.getByRole("status")).toHaveTextContent("The run is finished.");
  });

  // The same row after a cancel accepts a resume and refuses a second cancel.
  stubRoutes({
    "/healthz": OK,
    "/events": [],
    "/transactions/tx-1": { ...ROW, status: "CANCELLED" },
  });
  await person.click(tabControl("Intake"));
  await person.click(tabControl("Run"));

  expect(await screen.findByText("Stopped by you")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Run it again/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Stop the run/ })).toBeNull();
});

it("shows the seven steps and their times from the event log", async () => {
  const person = userEvent.setup();
  const log = [
    {
      event_id: "e1",
      tx_id: "tx-1",
      node: "scan_github_repository",
      state: "STARTED",
      started_at: "2026-08-22T10:00:00.000Z",
      finished_at: null,
      error: null,
    },
    {
      event_id: "e2",
      tx_id: "tx-1",
      node: "scan_github_repository",
      state: "COMPLETED",
      started_at: "2026-08-22T10:00:00.000Z",
      finished_at: "2026-08-22T10:00:01.500Z",
      error: null,
    },
    {
      event_id: "e3",
      tx_id: "tx-1",
      node: "extraction_agent",
      state: "STARTED",
      started_at: "2026-08-22T10:00:01.500Z",
      finished_at: null,
      error: null,
    },
  ];
  stubRoutes({
    "/healthz": OK,
    "/events": log,
    "/transactions/tx-1": { ...ROW, status: "RUNNING" },
  });
  window.history.replaceState(null, "", "/#/run/tx-1");

  render(<App />);

  // One node finished, one is at work, and five wait.
  expect(await screen.findByText("1 of 7 done")).toBeInTheDocument();
  expect(screen.getAllByText("Waiting")).toHaveLength(5);
  expect(screen.getByText("At work")).toBeInTheDocument();

  // The time of a node and the count of the log are behind the control.
  const control = showMore();
  if (control === null) {
    throw new Error("The run screen must hold the Show more control.");
  }
  await person.click(control);
  expect(screen.getByText("1.5s")).toBeInTheDocument();
  expect(screen.getByText("3", { selector: "dd" })).toBeInTheDocument();
});

it("opens the review desk when a run stops and waits for a person", async () => {
  // The row says RUNNING for the first read and PENDING_APPROVAL for the read
  // after it, so the state changes while the person watches. The move needs that
  // change and not the state, because a person who opens a run that already
  // finished must stay on the run screen.
  const rows = [{ ...ROW, status: "RUNNING", completed_at: null }, ROW];
  let read = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const address = String(input);
      let body: unknown = OK;
      // The review desk opens at the end of this test, and it reads the rules of
      // the person, so that address needs a list and not a health report.
      if (address.includes("/events") || address.includes("/rules")) {
        body = [];
      } else if (address.includes("/transactions/tx-1")) {
        body = rows[Math.min(read, rows.length - 1)];
        read += 1;
      }
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );

  window.history.replaceState(null, "", "/#/run/tx-1");
  render(<App />);

  // The second read comes one poll after the first, so this waits longer than
  // the default.
  await waitFor(() => expect(window.location.hash).toBe("#/review/tx-1"), {
    timeout: 4000,
  });
  expect(tabControl("Review")).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("status")).toHaveTextContent("The review desk is open.");
});

it("shows no run at all while the first read is out", async () => {
  // The fold of an empty log gives seven waiting rows, so a screen that draws
  // rows before the answer arrives states that the run has not started. On Cloud
  // Run that false state held for as long as the round trip took.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const address = String(input);
      if (address.includes("/transactions/") || address.includes("/events")) {
        // Never answers, so the screen stays in its first read.
        return new Promise<Response>(() => {});
      }
      return new Response(JSON.stringify(OK), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );

  window.history.replaceState(null, "", "/#/run/tx-1");
  render(<App />);

  // The word "Reading" is the note of the card and it is also the name of every
  // bar of the skeleton, so the list itself is the thing to wait for.
  await waitFor(() =>
    expect(screen.getByRole("list")).toHaveAttribute("aria-busy", "true"),
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(NODE_ORDER.length);
  // No row may carry a state, and no count may say that none is done.
  expect(screen.queryByText("Waiting")).toBeNull();
  expect(screen.queryByText(/of 7 done/)).toBeNull();
});
