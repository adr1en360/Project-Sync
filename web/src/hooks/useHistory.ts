import { useCallback, useEffect, useRef, useState } from "react";
import { getRunEvents, listTransactions, resumeRun, seedBulletsFrom } from "../api/client";
import { RESUMABLE_STATUSES, type Transaction } from "../api/types";
import { rowsOf, type NodeRow } from "./useTransaction";

/**
 * Every run that a person has made.
 *
 * The list is the same read that the portfolio makes, with no status, so one
 * request gives every run in every state. The history shows all of them, because
 * a run that failed is the run a person most wants to find.
 *
 * The time of each node is not in the list. It is in the event log of one run, so
 * the log is read only for a run that a person opens, and the answer is held. A
 * person who opens three runs makes three requests, and a person who opens none
 * makes no request for a timing at all.
 */

/** The steps of one run, while they load, when they arrive, or when they fail. */
export type Steps =
  | { kind: "loading" }
  | { kind: "rows"; rows: NodeRow[] }
  | { kind: "error"; why: string };

export type Ledger = {
  rows: readonly Transaction[] | null;
  loading: boolean;
  error: string | null;
  /** The steps of each run that a person opened, by transaction id. */
  steps: Record<string, Steps | undefined>;
  /** The run that a control is working on, or null. */
  busy: string | null;
  /** What the service said about the last press of "Add its bullets". */
  said: string | null;
  reload: () => void;
  /** Read the steps of one run. A second call for the same run does nothing. */
  askSteps: (txId: string) => void;
  /** Run Phase 1 again under the same id. Answers the id, or null on a failure. */
  resume: (txId: string) => Promise<string | null>;
  /** Put the bullets of one run into the bank. */
  fill: (txId: string) => Promise<void>;
};

/** Tell if the service accepts a resume for this state. */
export function canResume(status: Transaction["status"]): boolean {
  return RESUMABLE_STATUSES.includes(status);
}

export function useHistory(userId = "default"): Ledger {
  const [rows, setRows] = useState<readonly Transaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<Record<string, Steps | undefined>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [turn, setTurn] = useState(0);

  const again = useRef<() => void>(() => {});

  useEffect(() => {
    let live = true;
    listTransactions(userId)
      .then((got) => {
        if (!live) {
          return;
        }
        if (!Array.isArray(got)) {
          setError("The service did not answer with a list of runs.");
          return;
        }
        setRows(got);
        setError(null);
      })
      .catch((why: unknown) => {
        if (live) {
          setError(why instanceof Error ? why.message : "The history did not answer.");
        }
      });
    return () => {
      live = false;
    };
  }, [turn, userId]);

  again.current = useCallback(() => {
    setTurn((was) => was + 1);
  }, []);

  const reload = useCallback(() => {
    setSteps({});
    again.current();
  }, []);

  /**
   * Read the steps of one run.
   *
   * The guard is on the state that is held, so a person who opens a run, closes
   * it and opens it again makes one request. A run whose read failed is asked
   * again, because the failure can be a network that came back.
   */
  const askSteps = useCallback((txId: string) => {
    setSteps((was) => {
      const held = was[txId];
      if (held !== undefined && held.kind !== "error") {
        return was;
      }
      void getRunEvents(txId)
        .then((events) => {
          setSteps((now) => ({ ...now, [txId]: { kind: "rows", rows: rowsOf(events) } }));
        })
        .catch((why: unknown) => {
          setSteps((now) => ({
            ...now,
            [txId]: {
              kind: "error",
              why: why instanceof Error ? why.message : "The log did not answer.",
            },
          }));
        });
      return { ...was, [txId]: { kind: "loading" } };
    });
  }, []);

  const resume = useCallback(async (txId: string) => {
    setBusy(txId);
    setError(null);
    setSaid(null);
    try {
      const started = await resumeRun(txId);
      return started.transaction_id;
    } catch (why: unknown) {
      setError(why instanceof Error ? why.message : "The run did not start again.");
      return null;
    } finally {
      setBusy(null);
    }
  }, []);

  const fill = useCallback(async (txId: string) => {
    setBusy(txId);
    setError(null);
    setSaid(null);
    try {
      const result = await seedBulletsFrom(txId);
      // The service writes nothing the second time and it says why, so the
      // sentence of the service is the sentence that a person reads.
      if (result.seeded > 0) {
        const many = result.seeded === 1 ? "1 bullet" : `${String(result.seeded)} bullets`;
        setSaid(`${many} went into the bank.`);
      } else {
        setSaid(result.message ?? "The bank already holds the bullets of this run.");
      }
    } catch (why: unknown) {
      setError(why instanceof Error ? why.message : "The bullets did not go into the bank.");
    } finally {
      setBusy(null);
    }
  }, []);

  return {
    rows,
    loading: rows === null && error === null,
    error,
    steps,
    busy,
    said,
    reload,
    askSteps,
    resume,
    fill,
  };
}
