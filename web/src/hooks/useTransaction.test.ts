import { expect, it } from "vitest";
import type { RunEvent, RunEventState } from "../api/types";
import { NODE_ORDER, type NodeName } from "../labels";
import { rowsOf } from "./useTransaction";

/**
 * The fold of the event log into the seven rows.
 *
 * The service gives the log in the order that Firestore chooses, and that order
 * is not always the order of the run, because the two events of one node hold the
 * same start time. These tests hold the fold to the run and not to the answer.
 */

function event(
  node: NodeName,
  state: RunEventState,
  at: string,
  ends: string | null = null,
): RunEvent {
  return {
    event_id: `${node}:${state}:${at}`,
    tx_id: "tx-1",
    node,
    state,
    started_at: at,
    finished_at: ends,
    error: null,
  };
}

const T = [
  "2026-08-22T10:00:00.000Z",
  "2026-08-22T10:00:01.000Z",
  "2026-08-22T10:00:02.000Z",
  "2026-08-22T10:00:03.000Z",
  "2026-08-22T10:00:04.000Z",
];

it("folds a node that is done when the log gives its end before its start", () => {
  // This is the defect that a run on Cloud Run showed: step 1 read "At work"
  // while steps 2, 3 and 4 read "Done", which no sequential graph can do. The
  // first node is the only one the order can hurt, because the cut of the last
  // attempt looks for its start.
  const log = [
    event(NODE_ORDER[0], "COMPLETED", T[0], T[1]),
    event(NODE_ORDER[0], "STARTED", T[0]),
    event(NODE_ORDER[1], "STARTED", T[1]),
    event(NODE_ORDER[1], "COMPLETED", T[1], T[2]),
    event(NODE_ORDER[2], "STARTED", T[2]),
    event(NODE_ORDER[2], "COMPLETED", T[2], T[3]),
    event(NODE_ORDER[3], "STARTED", T[3]),
    event(NODE_ORDER[3], "COMPLETED", T[3], T[4]),
    event(NODE_ORDER[4], "STARTED", T[4]),
  ];

  const rows = rowsOf(log);
  expect(rows.map((row) => row.state)).toEqual([
    "pass",
    "pass",
    "pass",
    "pass",
    "work",
    "wait",
    "wait",
  ]);
  // The length of the first node is read as well, so the time of a node does not
  // depend on the order either.
  expect(rows[0].ms).toBe(1000);
  expect(rows[0].word).toBe("Done");
});

it("shows the last attempt only, and no mark of the attempt before it", () => {
  // A resume runs Phase 1 again under the same transaction id, and the log is
  // append-only, so both attempts are in it.
  const log = [
    event(NODE_ORDER[0], "STARTED", T[0]),
    event(NODE_ORDER[0], "COMPLETED", T[0], T[1]),
    event(NODE_ORDER[1], "STARTED", T[1]),
    event(NODE_ORDER[1], "CANCELLED", T[1], T[2]),
    event(NODE_ORDER[0], "STARTED", T[3]),
  ];

  const rows = rowsOf(log);
  expect(rows[0].state).toBe("work");
  expect(rows[1].state).toBe("wait");
});

it("gives one row for each node of the graph, in the order of the graph", () => {
  const rows = rowsOf([]);
  expect(rows).toHaveLength(NODE_ORDER.length);
  expect(rows.map((row) => row.node)).toEqual([...NODE_ORDER]);
  expect(rows.every((row) => row.state === "wait")).toBe(true);
});
