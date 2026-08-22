import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cancelRun, getRunEvents, getTransaction, resumeRun } from "../api/client";
import {
  CANCELLABLE_STATUS,
  RESUMABLE_STATUSES,
  type RunEvent,
  type RunEventState,
  type Transaction,
} from "../api/types";
import { NODE, NODE_ORDER, type NodeName } from "../labels";

/**
 * One run, read from the service.
 *
 * The hook holds the row and the event log of one transaction, and it folds the
 * log into one line for each of the seven nodes. It also holds the two controls
 * of a run, and it says when each control is legal.
 *
 * The hook polls. A graph workflow does not stream, and Phase 1 takes 30 to 90
 * seconds, so the client asks again while the row says RUNNING and stops when it
 * says anything else. Every other state is an end of Phase 1.
 *
 * `canCancel` and `canResume` are the same rule as the service. The service
 * answers 409 for a control that does not fit the state of the row, so a control
 * that would get that answer is never on the screen.
 */

/** The seconds between two reads while the graph runs. */
const POLL_MS = 1200;

/** How many failed reads in a row before the hook stops asking. */
const MISS_LIMIT = 3;

export type RowState = "pass" | "fail" | "hold" | "work" | "wait";

export type NodeRow = {
  node: NodeName;
  /** The sentence that a person reads. */
  label: string;
  state: RowState;
  /** The word for the state. Colour is never the only channel. */
  word: string;
  /** The milliseconds that the node took, or null while it is not finished. */
  ms: number | null;
};

const WORD: Record<RowState, string> = {
  pass: "Done",
  fail: "Failed",
  hold: "Stopped",
  work: "At work",
  wait: "Waiting",
};

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

/**
 * Which of two events of one node comes first when both give the same time.
 *
 * The event that ends a node carries the time that the node started, because the
 * length of the node is the difference between that time and the time it ended.
 * So the two events of one node hold the same value in the field that the service
 * orders by. Firestore then has a tie, and it breaks a tie with the id of the
 * document, which is not the order of the run.
 */
const STATE_RANK: Record<RunEventState, number> = {
  STARTED: 0,
  COMPLETED: 1,
  FAILED: 1,
  CANCELLED: 1,
};

/**
 * Put the log in the order of the run.
 *
 * The client does not trust the order that it receives. The cut of the last
 * attempt looks for the last start of the first node, so an end that arrives
 * before its own start puts that start outside the cut, and the first row then
 * says "At work" for the whole run.
 */
function ordered(events: readonly RunEvent[]): RunEvent[] {
  return [...events].sort((one, two) => {
    if (one.started_at !== two.started_at) {
      return one.started_at < two.started_at ? -1 : 1;
    }
    return STATE_RANK[one.state] - STATE_RANK[two.state];
  });
}

/**
 * Keep the events of the last attempt only.
 *
 * A resume is a new run of Phase 1 under the same transaction id, and the log is
 * append-only, so the log then holds the events of both attempts. The last
 * attempt starts at the last STARTED of the first node. Without this cut, the
 * first six rows of a resumed run show the marks of the attempt that stopped.
 */
export function lastAttempt(events: readonly RunEvent[]): RunEvent[] {
  let first = 0;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.node === NODE_ORDER[0] && event.state === "STARTED") {
      first = index;
      break;
    }
  }
  return events.slice(first);
}

function spanMs(started: RunEvent | null, ended: RunEvent | null): number | null {
  if (started === null || ended === null) {
    return null;
  }
  const from = Date.parse(started.started_at);
  const to = Date.parse(ended.finished_at ?? ended.started_at);
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) {
    return null;
  }
  return to - from;
}

/**
 * Fold the event log into one row for each node.
 *
 * The order comes from `NODE_ORDER` and not from the log, so the seven steps
 * stand still while the run walks through them. A node with no event waits.
 */
export function rowsOf(events: readonly RunEvent[]): NodeRow[] {
  const attempt = lastAttempt(ordered(events));

  return NODE_ORDER.map((node) => {
    const own = attempt.filter((event) => event.node === node);
    const started = own.filter((event) => event.state === "STARTED").at(-1) ?? null;
    const ended = own.filter((event) => event.state !== "STARTED").at(-1) ?? null;

    let state: RowState = "wait";
    if (ended === null) {
      if (started !== null) {
        state = "work";
      }
    } else if (ended.state === "COMPLETED") {
      state = "pass";
    } else if (ended.state === "FAILED") {
      state = "fail";
    } else {
      state = "hold";
    }

    return { node, label: NODE[node], state, word: WORD[state], ms: spanMs(started, ended) };
  });
}

export type RunState = {
  tx: Transaction | null;
  rows: NodeRow[];
  events: RunEvent[];
  /** How many of the seven nodes are finished. */
  done: number;
  /** A read or a control that failed. It is a sentence from the service. */
  error: string | null;
  loading: boolean;
  busy: boolean;
  /** Read the row and the log again, now. */
  refresh: () => void;
  canCancel: boolean;
  canResume: boolean;
  cancel: () => void;
  resume: () => void;
};

export function useTransaction(txId: string | null): RunState {
  const [tx, setTx] = useState<Transaction | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // A control changes the row, so it reads again at once instead of waiting for
  // the next poll. The reference always holds the reader of the current id.
  const again = useRef<() => void>(() => {});

  useEffect(() => {
    if (txId === null) {
      again.current = () => {};
      return;
    }

    let live = true;
    let timer: number | undefined;
    let misses = 0;

    const pull = async (): Promise<void> => {
      // Clear first, so one chain of reads exists and a control cannot double
      // the rate of the poll.
      window.clearTimeout(timer);
      try {
        const [row, log] = await Promise.all([getTransaction(txId), getRunEvents(txId)]);
        if (!live) {
          return;
        }
        misses = 0;
        setTx(row);
        setEvents(log);
        setFailure(null);
        if (row.status === CANCELLABLE_STATUS) {
          timer = window.setTimeout(() => void pull(), POLL_MS);
        }
      } catch (reason) {
        if (!live) {
          return;
        }
        misses += 1;
        setFailure({ id: txId, message: messageOf(reason) });
        // One bad answer is not the end of a run, so ask again, slower. A row
        // that is absent never arrives, so stop after a few tries and leave the
        // sentence of the service on the screen.
        if (misses < MISS_LIMIT) {
          timer = window.setTimeout(() => void pull(), POLL_MS * 3);
        }
      }
    };

    again.current = () => void pull();
    void pull();

    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [txId]);

  const act = useCallback(
    (call: (id: string) => Promise<unknown>) => {
      if (txId === null) {
        return;
      }
      setBusy(true);
      call(txId).then(
        () => {
          setBusy(false);
          setFailure(null);
          again.current();
        },
        (reason: unknown) => {
          setBusy(false);
          setFailure({ id: txId, message: messageOf(reason) });
          again.current();
        },
      );
    },
    [txId],
  );

  const cancel = useCallback(() => act(cancelRun), [act]);
  const resume = useCallback(() => act(resumeRun), [act]);

  /**
   * Read the row and the log again, now.
   *
   * The poll stops when the run leaves RUNNING, and the approval of Phase 2
   * changes the row long after that. So the screen that made the change asks for
   * a read instead of waiting for a poll that no longer runs.
   */
  const refresh = useCallback(() => {
    again.current();
  }, []);

  // Every value below answers for the id that the screen asks for. A row or an
  // event of another id is not shown, so a change of id needs no write from an
  // effect and the screen never holds a fact of the run before it.
  const row = tx !== null && tx.tx_id === txId ? tx : null;
  const log = useMemo(
    () => events.filter((event) => event.tx_id === txId),
    [events, txId],
  );
  const rows = useMemo(() => rowsOf(log), [log]);
  const error = failure !== null && failure.id === txId ? failure.message : null;
  const status = row?.status ?? null;

  return {
    tx: row,
    rows,
    events: log,
    done: rows.filter((item) => item.state === "pass").length,
    error,
    loading: txId !== null && row === null && error === null,
    busy,
    refresh,
    canCancel: status === CANCELLABLE_STATUS,
    canResume: status !== null && RESUMABLE_STATUSES.includes(status),
    cancel,
    resume,
  };
}