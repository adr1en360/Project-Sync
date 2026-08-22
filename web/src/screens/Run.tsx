import { useEffect, useRef } from "react";
import type { TransactionStatus } from "../api/types";
import { useShowMore } from "../hooks/useShowMore";
import { useTransaction } from "../hooks/useTransaction";
import { GRAPH_NAME, NODE_ORDER, STATUS, STATUS_TONE } from "../labels";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Mark } from "../ui/Mark";
import { Skeleton } from "../ui/Skeleton";
import { Switch } from "../ui/Switch";
import { Tag } from "../ui/Tag";
import { ScreenHead } from "./ScreenHead";

/**
 * Step 2. The graph at work.
 *
 * The seven rows are the seven nodes of the Phase 1 graph, and they come from
 * `GET /transactions/{id}/events`. The order is the order of the graph, so the
 * rows stand still and the marks move.
 *
 * The two controls of a run are here, and each one shows only in the state that
 * the service accepts for it. `useTransaction` holds that rule.
 *
 * With no id in the address the screen still lists the seven steps, all of them
 * waiting. The steps are what the product does, so they are worth reading before
 * a run exists.
 *
 * The screen holds its own "Show more" control. Off, each row is one short
 * sentence. On, each row also shows the name of the node and the time it took,
 * and the rail names the graph and counts the events.
 */

type Props = {
  /** The transaction id from the address, or null when no run is open. */
  txId: string | null;
  /** Say something that a person did not ask to happen. */
  announce: (text: string) => void;
  /** Open the review desk. Called when the run stops and waits for a person. */
  onDone: (txId: string) => void;
};

/** Show a time that a person can read. Under a second still reads as a time. */
function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function Run({ txId, announce, onDone }: Props) {
  const { more, toggleMore } = useShowMore();
  const open = more ? "true" : "false";
  const shut = more ? undefined : true;
  const { tx, rows, events, done, error, loading, busy, canCancel, canResume, cancel, resume } =
    useTransaction(txId);

  const status = tx?.status ?? null;

  /**
   * The state that this screen showed before the state it shows now.
   *
   * The move to the review desk needs the change and not the state. A person who
   * comes back to this screen after a run finished must stay on it, so the move
   * fires only at the moment the run leaves RUNNING while they watch.
   */
  const before = useRef<TransactionStatus | null>(null);

  // The end of a run is a change that a person did not ask for at that moment,
  // so it is said out loud. A run that stops and waits also opens the next step,
  // because the three steps carry the person and need no tab press.
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
        title="The run"
        lede="Seven steps, in order. The run stops at the end and waits for you. Nothing leaves the service until you approve it."
      />

      {/* The control of this screen. It sits here and not in the masthead,
          because it changes this screen and no other. */}
      <div className="screen-tools">
        <Switch
          pressed={more}
          onToggle={toggleMore}
          title="Show the name of each node of the graph and the time it took"
        >
          Show more
        </Switch>
      </div>

      <div className="layout">
        <Card
          title="The steps"
          note={
            loading
              ? "Reading"
              : txId === null
                ? "No run yet"
                : `${done} of ${NODE_ORDER.length} done`
          }
        >
          {/* While the first read is out, the rows are a skeleton of themselves.
              The fold of an empty log gives seven waiting rows, so without this
              a person who opens a run that already finished reads a run that has
              not started, for as long as the service takes to answer. */}
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
                  {/* The key is the state, so React puts a new element here when
                      the state changes and the mark can fade in. */}
                  <Mark key={row.state} state={row.state} />
                  <div style={{ minWidth: 0 }}>
                    <span>{row.label}</span>
                    {/* The name of the node. The reveal keeps it out of the page
                        when the control is off, so the row is one sentence. */}
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
            This run
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
            <dt className="quiet">State</dt>
            <dd style={{ margin: 0 }}>
              {status === null ? (
                <span className="faint">{loading ? "Reading" : "No run yet"}</span>
              ) : (
                <Tag tone={STATUS_TONE[status]}>{STATUS[status]}</Tag>
              )}
            </dd>
            <dt className="quiet">Repository</dt>
            <dd className="mono" style={{ margin: 0, overflowWrap: "anywhere" }}>
              {tx?.repo_name ?? "not started"}
            </dd>
            <dt className="quiet">Transaction</dt>
            <dd className="mono" style={{ margin: 0, overflowWrap: "anywhere" }}>
              {txId ?? "not started"}
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
              {/* Each control shows only in a state that the service accepts,
                  so neither one can be answered with 409. */}
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
              A new run starts at the first step and keeps this transaction id.
            </p>
          )}

          {tx?.error_message != null && tx.error_message !== "" && (
            <p className="field-error" style={{ marginTop: "var(--sp-4)" }}>
              {tx.error_message}
            </p>
          )}

          {error !== null && (
            <p className="field-error" role="alert" style={{ marginTop: "var(--sp-4)" }}>
              {error}
            </p>
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