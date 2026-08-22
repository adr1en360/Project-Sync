// The matchers of `jest-dom` for Vitest. Each test file gets them from here, so
// no test file needs this import.
import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library takes the page out of the document after each test by itself,
// but only when the test framework puts its functions in the global scope. This
// project asks each test file to import what it uses, so that automatic clean up
// never starts and this file must ask for it. Without this call, one test leaves
// its page in the document and the next test finds two of every control.
afterEach(() => {
  cleanup();
});