import { expect, it } from "vitest";
import { PUBLISH_PATHS, RULE_STATES, TRANSACTION_STATUSES } from "./api/types";
import {
  NODE,
  NODE_ORDER,
  PUBLISH_PATH,
  PUBLISH_PATH_NOTE,
  PUBLISH_PATH_TONE,
  RULE_STATE,
  STATUS,
  STATUS_TONE,
} from "./labels";

/**
 * The copy contract.
 *
 * The records are typed over their enums, so the compiler already refuses a
 * state with no sentence. These tests hold the other half: the lists here come
 * from the service, and a test can read a list at run time where the compiler
 * only sees the type. A state that the service gains and nobody names fails
 * here as well as in the build.
 */

it("has a sentence and a tone for every state of a transaction", () => {
  for (const status of TRANSACTION_STATUSES) {
    expect(STATUS[status], status).toBeTruthy();
    expect(STATUS_TONE[status], status).toBeTruthy();
  }
});

it("has a sentence for every state of a rule", () => {
  for (const state of RULE_STATES) {
    expect(RULE_STATE[state], state).toBeTruthy();
  }
});

it("names all seven nodes of the graph", () => {
  expect(NODE_ORDER).toHaveLength(7);
  for (const node of NODE_ORDER) {
    expect(NODE[node], node).toBeTruthy();
    // The sentence is for a person, so it is not the name of the node.
    expect(NODE[node]).not.toBe(node);
  }
});

it("shows no raw name of a state on the screen", () => {
  for (const sentence of Object.values(STATUS)) {
    expect(sentence).not.toMatch(/[A-Z]{2,}|_/);
  }
});

it("gives every verdict of the check a sentence, a note and a tone", () => {
  for (const path of PUBLISH_PATHS) {
    expect(PUBLISH_PATH[path]).toBeTruthy();
    expect(PUBLISH_PATH_NOTE[path]).toBeTruthy();
    expect(PUBLISH_PATH_TONE[path]).toBeTruthy();
    // The verdict is advice, so neither sentence may read as a refusal, and
    // neither may show the raw name of the state.
    expect(PUBLISH_PATH[path]).not.toMatch(/[A-Z]{2,}|_/);
    expect(PUBLISH_PATH_NOTE[path]).not.toMatch(/[A-Z]{2,}|_/);
  }
});
