import { useId, useState } from "react";
import { type Transaction } from "../api/types";
import { seconds, when } from "../format";
import { canResume, type Steps } from "../hooks/useHistory";
import { STATUS, STATUS_TONE } from "../labels";
import { Button } from "../ui/Button";
import { Mark } from "../ui/Mark";
import { Skeleton } from "../ui/Skeleton";
import { Tag } from "../ui/Tag";

/**
 * One run of the history, with the time of each node behind its own control.
 *
 * The control for the times is on the row and not on the screen and not in the
 * masthead. A control that changes one thing belongs on that thing, and a row is
 * the smallest place this control can sit. It also decides the cost: the event
 * log of a run is read the first time a person opens that row, so a person who
 * opens none makes no request for a timing at all.
 *
 * Every control here is gated on the state of the run, because the service
 * answers 409 for a state it does not accept, and a control that cannot work must
 * not be on the screen. A resume needs a state in `RESUMABLE_STATUSES`, and the
 * bullets of a run need a run that committed.
 */

type Props = {
  row: Transaction;
  steps: Steps | undefined;
  /** True while a request for this run is in flight. */
  busy: boolean;
  onSteps: () => void;
  onOpen: () => void;
  onReview: () => void;
  onResume: () => void;
  onFill: () => void;
};

export function HistoryRow({
  row,
  steps,
  busy,
  onSteps,
  onOpen,
  onReview,
  onResume,
  onFill,
}: Props) {
  const paneId = useId();
  const [open, setOpen] = useState(false);

  const waiting = row.status === "PENDING_APPROVAL";
  const committed = row.status === "COMPLETED" || row.status === "PARTIAL";

  return (
    <li className="rule-row">
      <p className="rule-text">
        <span className="mono">{row.repo_name === "" ? row.repo_url : row.repo_name}</span>
      </p>

      <p className="rule-foot quiet">
        <Tag tone={STATUS_TONE[row.status]}>{STATUS[row.status]}</Tag>
        <span className="faint">{when(row.created_at)}</span>
        {row.error_message !== null && row.error_message !== "" && (
          <span className="faint">{row.error_message}</span>
        )}
      </p>

      <p className="row-controls">
        {/* The desk is where a run that waits needs a person, so that run offers
            the desk and not the graph. */}
        {waiting ? (
          <Button tone="primary" onClick={onReview}>
            Review it
          </Button>
        ) : (
          <Button tone="quiet" onClick={onOpen}>
            Open the run
          </Button>
        )}

        {canResume(row.status) && (
          <Button tone="plain" busy={busy} onClick={onResume}>
            {busy ? "Starting" : "Run it again"}
          </Button>
        )}

        {/* The approval of a run fills the bank by itself, but only when both
            commits land. A run that committed one of the two has no bullets, and
            this is the way to get them. The service writes nothing the second
            time, so the control is safe to press again. */}
        {committed && (
          <Button tone="quiet" busy={busy} onClick={onFill}>
            {busy ? "Working" : "Add its bullets"}
          </Button>
        )}

        <Button
          tone="quiet"
          aria-expanded={open}
          aria-controls={paneId}
          onClick={() => {
            if (!open) {
              onSteps();
            }
            setOpen(!open);
          }}
        >
          {open ? "Hide the steps" : "Steps and times"}
        </Button>
      </p>

      <div className="reveal" data-open={open ? "true" : "false"} aria-hidden={open ? undefined : true}>
        <div className="reveal-body" id={paneId}>
          <div className="row-steps">
            {steps === undefined || steps.kind === "loading" ? (
              <ol className="node-list" aria-busy="true">
                {[0, 1, 2, 3, 4, 5, 6].map((index) => (
                  <li key={index} className="node-row" data-state="wait">
                    <Skeleton width="0.7rem" height="0.7rem" radius="999px" />
                    <Skeleton width="11rem" height="0.9rem" />
                    <Skeleton width="3.5rem" height="0.9rem" />
                  </li>
                ))}
              </ol>
            ) : steps.kind === "error" ? (
              <p className="field-error" role="alert">
                The steps of this run did not arrive. {steps.why}
              </p>
            ) : (
              <ol className="node-list">
                {steps.rows.map((step) => (
                  <li key={step.node} className="node-row" data-state={step.state}>
                    <Mark state={step.state} />
                    <div style={{ minWidth: 0 }}>
                      <span>{step.label}</span>
                      <span
                        className="mono faint"
                        style={{ display: "block", fontSize: "var(--step--1)" }}
                      >
                        {step.node}
                      </span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span className="faint" style={{ fontSize: "var(--step--1)" }}>
                        {step.word}
                      </span>
                      <span
                        className="mono faint node-time"
                        style={{ display: "block", fontSize: "var(--step--1)" }}
                      >
                        {step.ms === null ? "" : seconds(step.ms)}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
