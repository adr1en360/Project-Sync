import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import { TABS } from "./nav";

/**
 * The shell.
 *
 * The tests are the promise of stage F3: every screen opens, the theme moves
 * through the three modes, the accent menu changes the hue and answers the
 * keyboard, the internals appear and go away again on the shell and on the run
 * screen, and the three choices come back after a reload.
 */

const OK = {
  status: "ok",
  model: "gemini-3.5-flash",
  use_vertex_ai: true,
  missing_config: [],
};

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
  stubFetch(OK);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function tabControl(label: string) {
  return screen.getByRole("button", { name: new RegExp(label) });
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

it("shows the name of each node on the run screen with internals on", async () => {
  const person = userEvent.setup();
  render(<App />);

  await person.click(tabControl("Run"));

  // The name is in the page and the reveal is shut, so nothing reads it.
  const reveal = () =>
    screen.getByText("scan_github_repository").closest(".reveal");
  expect(reveal()).toHaveAttribute("aria-hidden", "true");

  await person.click(screen.getByRole("button", { name: "Internals" }));

  expect(reveal()).not.toHaveAttribute("aria-hidden");
  expect(screen.getByText("persist_transaction")).toBeInTheDocument();
});

it("reveals the internals and hides them again", async () => {
  const person = userEvent.setup();
  render(<App />);

  expect(screen.queryByRole("region", { name: "Service" })).toBeNull();

  await person.click(screen.getByRole("button", { name: "Internals" }));
  expect(await screen.findByRole("region", { name: "Service" })).toHaveTextContent(
    "gemini-3.5-flash",
  );

  await person.click(screen.getByRole("button", { name: "Internals" }));
  expect(screen.queryByRole("region", { name: "Service" })).toBeNull();
});

it("keeps the three choices after a reload", async () => {
  window.localStorage.setItem("projectsync.mode", "dark");
  window.localStorage.setItem("projectsync.hue", "rose");
  window.localStorage.setItem("projectsync.internals", "on");

  render(<App />);

  expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  expect(document.documentElement.getAttribute("data-hue")).toBe("rose");
  expect(await screen.findByRole("region", { name: "Service" })).toBeInTheDocument();
});

it("shows the model that the service reports", async () => {
  const person = userEvent.setup();
  render(<App />);

  await person.click(screen.getByRole("button", { name: "Internals" }));

  expect(await screen.findByText("gemini-3.5-flash")).toBeInTheDocument();
});

it("shows the detail text when the service refuses", async () => {
  stubFetch({ detail: "Firestore refused the connection." }, 503);

  render(<App />);

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Firestore refused the connection.",
  );
});