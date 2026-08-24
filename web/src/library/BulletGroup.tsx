import type { CSSProperties } from "react";
import type { Change } from "../hooks/useBullets";
import { CheckIcon, CopyIcon } from "../ui/icons";
import { BulletRow } from "./BulletRow";
import { groupKey, groupText, type Group } from "./group";

/**
 * One project repository in the bullet bank, displaying grouped bullet points.
 *
 * Provides a header with repository name, count badge, and a "Copy all" button.
 */

type Props = {
  group: Group;
  /** Index for entrance animation stagger. */
  index: number;
  /** Active copy key if clipboard operation was performed. */
  copied: string | null;
  /** ID of currently updating bullet. */
  busy: string | null;
  onCopy: (name: string, text: string) => void;
  onSave: (bulletId: string, change: Change) => Promise<boolean>;
  onRemove: (bulletId: string) => Promise<boolean>;
};

export function BulletGroup({
  group,
  index,
  copied,
  busy,
  onCopy,
  onSave,
  onRemove,
}: Props) {
  const name = group.project === "" ? "General" : group.project;
  const done = copied === groupKey(group.project);
  const count = group.rows.length;

  return (
    <section className="bank-group" style={{ "--index": index } as CSSProperties}>
      <header className="bank-group-head">
        <h3 className="bank-group-name">{name}</h3>
        <span className="bank-group-count mono">{count}</span>

        <button
          type="button"
          className="btn-tiny bank-group-copy"
          onClick={() => {
            onCopy(groupKey(group.project), groupText(group));
          }}
          aria-label={done ? "Copied" : `Copy all ${String(count)} bullets for ${name}`}
          title={
            count === 1
              ? `Copy bullet for ${name}`
              : `Copy all ${String(count)} bullets for ${name}`
          }
        >
          {done ? <CheckIcon /> : <CopyIcon />}
          {done ? "Copied" : "Copy all"}
        </button>
      </header>

      <ul className="bank-list">
        {group.rows.map((row) => (
          <BulletRow
            key={row.bullet_id}
            row={row}
            busy={busy === row.bullet_id}
            copied={copied === row.bullet_id}
            onCopy={() => {
              onCopy(row.bullet_id, row.text);
            }}
            onSave={(change) => onSave(row.bullet_id, change)}
            onRemove={() => onRemove(row.bullet_id)}
          />
        ))}
      </ul>
    </section>
  );
}
