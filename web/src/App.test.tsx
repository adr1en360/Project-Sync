import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

it("shows the model that the service reports", async () => {
  stubFetch({
    status: "ok",
    model: "gemini-3.5-flash",
    use_vertex_ai: true,
    missing_config: [],
  });

  render(<App />);

  expect(await screen.findByText("gemini-3.5-flash")).toBeInTheDocument();
});

it("shows the detail text when the service refuses", async () => {
  stubFetch({ detail: "Firestore refused the connection." }, 503);

  render(<App />);

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Firestore refused the connection.",
  );
});
