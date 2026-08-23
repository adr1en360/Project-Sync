import { useState } from "react";
import type { StyleRule } from "../api/types";
import { Button } from "../ui/Button";
import { CloseIcon } from "../ui/icons";
import { Tag } from "../ui/Tag";
import { Toggle } from "../ui/Toggle";

/**
 * One rule of the voice.
 *
 * The row is the same object on the review rail and in the library, so it lives
 * here and not in either screen. It was in `Review.tsx` before, and it showed the
 * state of the rule three times over: a pill, a button that named the opposite
 * state, and a second button. Now the switch is the state and the press of it is
 * the change.
 *
 * The control that removes a rule is a cross at the end of the row, and it is
 * quiet until a pointer or the keyboard reaches the row. A rule is easy to write
 * again but the removal is final, so the cross arms a question first. This is the
 * same two press pattern that a bullet uses, because the two rows sit in the same
 * list and a person must not have to learn the shape twice.
 */

type Props = {
  rule: StyleRule;
  /** True if this rule went into the run that is on the screen. */
  used?: boolean;
  /** True while the service is writing a change to this rule. */
  busy: boolean;
  onToggle: () => void;
  onRemove: () => void;
};

export function RuleRow({ rule, used = false, busy, onToggle, onRemove }: Props) {
  const [armed, setArmed] = useState(false);
  const on = rule.state === "ACTIVE";
  const fresh = rule.state === "PROPOSED";

  return (
    <li
      className="rule-row rule-row-lead"
      data-on={on ? "true" : "false"}
      data-fresh={fresh ? "true" : undefined}
    >
      <Toggle
        on={on}
        busy={busy}
        label={
          on
            ? `This rule is on. Press to turn it off. ${rule.text}`
            : `This rule is off. Press to turn it on. ${rule.text}`
        }
        onToggle={onToggle}
      />

      <div className="rule-body">
        <p className="rule-text">{rule.text}</p>

        <p className="rule-foot quiet">
          {/* Only a fact that a person cannot see for themselves. The state is
              the switch, so the state is not written again here. */}
          {used && <Tag tone="accent">Used in this run</Tag>}
          <span className="faint">
            {rule.source === "CURATOR" ? "Found by the curator" : "Written by you"}
          </span>
        </p>

        {armed && (
          <p className="row-controls">
            <span className="quiet">Remove this rule for good?</span>
            <Button tone="danger" busy={busy} onClick={onRemove}>
              Remove it
            </Button>
            <Button
              tone="quiet"
              onClick={() => {
                setArmed(false);
              }}
            >
              Keep it
            </Button>
          </p>
        )}
      </div>

      {!armed && (
        <button
          type="button"
          className="row-kill"
          aria-label={`Remove this rule. ${rule.text}`}
          title="Remove this rule"
          onClick={() => {
            setArmed(true);
          }}
        >
          <CloseIcon />
        </button>
      )}
    </li>
  );
}
