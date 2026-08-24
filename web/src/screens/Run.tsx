import { useEffect, useRef } from "react";
import type { TransactionStatus } from "../api/types";
import { seconds } from "../format";
import { useShowMore } from "../hooks/useShowMore";
import { useTransaction } from "../hooks/useTransaction";
import { GRAPH_NAME, NODE_ORDER, STATUS, STATUS_TONE } from "../labels";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { ErrorCallout } from "../ui/ErrorCallout";
import { Mark } from "../ui/Mark";
import { Skeleton } from "../ui/Skeleton";
import { Switch } from "../ui/Switch";
import { Tag } from "../ui/Tag";
import { ScreenHead } from "./ScreenHead";

/**
 * Step 2: Live Pipeline Execution.
 *
 * Tracks the real-time execution of the 7 LangGraph nodes via `GET /transactions/{id}/events`.
 * Automatically transitions to the Review desk upon reaching `PENDING_APPROVAL`.
 */

type Props = {
  /** The transaction ID from the route, or null when no active run is selected. */
  txId: string | null;
  /** Accessibility announcement for automatic state transitions. */
  announce: (text: string) => void;
  /** Callback triggered when the run successfully finishes and awaits human review. */
  onDone: (txId: string) => void;
};

export function Run({ txId, announce, onDone }: Props) {
  const { more, toggleMore } = useShowMore();
  const open = more ? "true" : "false";
  const shut = more ? undefined : true;
  const { tx, rows, events, done, error, loading, busy, canCancel, canResume, cancel, resume } =
    useTransaction(txId);

  const status = tx?.status ?? null;
  const before = useRef<TransactionStatus | null>(null);

  useEffect(() => {
    const last = before.current;
    before.current = status;
    if (status === null || status === "RUNNING") {
      return;
    }
    announce(`The run is finished. ${STATUS[status]}.`);
    if (last === "RUNNING" && status === "PENDING_APPROVAL" && txId !== null) {
      onDone(txId);
    }
  }, [status, txId, announce, onDone]);

  return (
    <>
      <ScreenHead
        title="Pipeline Execution"
        lede="Seven automated pipeline steps extract, synthesize, and evaluate your repository. The workflow pauses for human approval before committing."
      />

      <div className="screen-tools">
        <Switch
          pressed={more}
          onToggle={toggleMore}
          title="Toggle technical node names and execution durations"
        >
          Show more
        </Switch>
      </div>

      <div className="layout">
        <Card
          title="Pipeline Steps"
          note={
            loading
              ? "Loading..."
              : txId === null
                ? "Awaiting repository"
                : `${done} of ${NODE_ORDER.length} done`
          }
        >
          {loading ? (
            <ol className="node-list" aria-busy="true">
              {NODE_ORDER.map((node) => (
                <li key={node} className="node-row" data-state="wait">
                  <Skeleton width="0.7rem" height="0.7rem" radius="999px" />
                  <Skeleton width="11rem" height="0.9rem" />
                  <Skeleton width="3.5rem" height="0.9rem" />
                </li>
              ))}
            </ol>
          ) : (
            <ol className="node-list">
              {rows.map((row) => (
                <li key={row.node} className="node-row" data-state={row.state}>
                  <Mark key={row.state} state={row.state} />
                  <div style={{ minWidth: 0 }}>
                    <span>{row.label}</span>
                    <div className="reveal" data-open={open} aria-hidden={shut}>
                      <div className="reveal-body">
                        <span
                          className="mono faint"
                          style={{ display: "block", fontSize: "var(--step--1)" }}
                        >
                          {row.node}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className="faint" style={{ fontSize: "var(--step--1)" }}>
                      {row.word}
                    </span>
                    <div className="reveal" data-open={open} aria-hidden={shut}>
                      <div className="reveal-body">
                        <span
                          className="mono faint node-time"
                          style={{ display: "block", fontSize: "var(--step--1)" }}
                        >
                          {row.ms === null ? "" : seconds(row.ms)}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <aside className="rail">
          <h2 className="card-title" style={{ fontSize: "var(--step-1)" }}>
            Run Summary
          </h2>
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "var(--sp-2) var(--sp-4)",
              margin: "var(--sp-4) 0 0",
              fontSize: "var(--step--1)",
            }}
          >
            <dt className="quiet">Status</dt>
            <dd style={{ margin: 0 }}>
              {status === null ? (
                <span className="faint">{loading ? "Loading..." : "Not started"}</span>
              ) : (
                <Tag tone={STATUS_TONE[status]}>{STATUS[status]}</Tag>
              )}
            </dd>
            <dt className="quiet">Repository</dt>
            <dd className="mono" style={{ margin: 0, overflowWrap: "anywhere" }}>
              {tx?.repo_name ?? "Not specified"}
            </dd>
            <dt className="quiet">Transaction</dt>
            <dd className="mono" style={{ margin: 0, overflowWrap: "anywhere" }}>
              {txId ?? "Not assigned"}
            </dd>
          </dl>

          {(canCancel || canResume) && (
            <div
              style={{
                display: "flex",
                gap: "var(--sp-3)",
                marginTop: "var(--sp-5)",
                flexWrap: "wrap",
              }}
            >
              {canCancel && (
                <Button tone="quiet" busy={busy} onClick={cancel}>
                  Stop the run
                </Button>
              )}
              {canResume && (
                <Button tone="primary" busy={busy} onClick={resume}>
                  Run it again
                </Button>
              )}
            </div>
          )}

          {canResume && (
            <p className="quiet" style={{ fontSize: "var(--step--1)" }}>
              Restarting will re-execute Phase 1 from the beginning under this transaction ID.
            </p>
          )}

          {tx?.error_message != null && tx.error_message !== "" && (
            <ErrorCallout error={tx.error_message} style={{ marginTop: "var(--sp-4)" }} />
          )}

          {error !== null && (
            <ErrorCallout error={error} style={{ marginTop: "var(--sp-4)" }} />
          )}

          <div className="reveal" data-open={open} aria-hidden={shut}>
            <div className="reveal-body">
              <dl
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: "var(--sp-2) var(--sp-4)",
                  margin: "var(--sp-4) 0 0",
                  fontSize: "var(--step--1)",
                }}
              >
                <dt className="quiet">Graph</dt>
                <dd className="mono faint" style={{ margin: 0 }}>
                  {GRAPH_NAME}
                </dd>
                <dt className="quiet">Nodes</dt>
                <dd className="mono faint" style={{ margin: 0 }}>
                  {NODE_ORDER.length}
                </dd>
                <dt className="quiet">Events</dt>
                <dd className="mono faint" style={{ margin: 0 }}>
                  {events.length}
                </dd>
              </dl>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}