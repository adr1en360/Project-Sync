import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Library } from "./Library";

const BULLETS = [
  {
    bullet_id: "b-1",
    user_id: "default",
    project: "Crucible",
    text: "Architected distributed worker pool reducing job latency by 45%.",
    tags: ["BACKEND", "PERFORMANCE"],
    source_transaction_id: "tx-1",
    is_manual_edit: false,
    created_at: "2026-08-24T10:00:00Z",
    updated_at: "2026-08-24T10:00:00Z",
  },
  {
    bullet_id: "b-2",
    user_id: "default",
    project: "Crucible",
    text: "Engineered streaming event broker processing 10k messages per second.",
    tags: ["BACKEND"],
    source_transaction_id: "tx-1",
    is_manual_edit: true,
    created_at: "2026-08-24T09:00:00Z",
    updated_at: "2026-08-24T09:00:00Z",
  },
  {
    bullet_id: "b-3",
    user_id: "default",
    project: "ProjectSync",
    text: "Built real-time execution visualizer using LangGraph SSE streams.",
    tags: ["FRONTEND"],
    source_transaction_id: "tx-2",
    is_manual_edit: false,
    created_at: "2026-08-23T14:00:00Z",
    updated_at: "2026-08-23T14:00:00Z",
  },
];

function stubLibrary(bullets = BULLETS) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/bullets")) {
        return new Response(JSON.stringify(bullets), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/transactions")) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/rules")) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }),
  );
}

const writeTextMock = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  writeTextMock.mockClear();
  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: writeTextMock,
    },
    configurable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("renders bullet bank grouped by project repository", async () => {
  stubLibrary();
  render(<Library segment="bullets" onSegment={vi.fn()} onGo={vi.fn()} />);

  expect(await screen.findByRole("heading", { name: "Crucible" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "ProjectSync" })).toBeInTheDocument();

  expect(screen.getByText("3 total")).toBeInTheDocument();
  expect(
    screen.getAllByText(/Architected distributed worker pool reducing job latency by 45%/)[0],
  ).toBeInTheDocument();
  expect(screen.getByText("Your edit")).toBeInTheDocument();
});

it("supports Copy All for a project group", async () => {
  stubLibrary();
  render(<Library segment="bullets" onSegment={vi.fn()} onGo={vi.fn()} />);

  await screen.findByRole("heading", { name: "Crucible" });
  const copyAllButtons = screen.getAllByRole("button", { name: /Copy all/i });
  expect(copyAllButtons.length).toBeGreaterThan(0);

  fireEvent.click(copyAllButtons[0]);
  expect(writeTextMock).toHaveBeenCalled();
});

it("displays empty state when no bullets exist", async () => {
  stubLibrary([]);
  render(<Library segment="bullets" onSegment={vi.fn()} onGo={vi.fn()} />);

  expect(await screen.findByText("No bullets saved yet")).toBeInTheDocument();
});
