import type { ReactNode } from "react";

/**
 * A control that changes the view inside one screen.
 *
 * It is not a tab of the shell. A tab of the shell changes the screen and it
 * writes the address; this changes what one screen shows. So it takes a different
 * shape: a short track with the choice raised out of it.
 *
 * The choice carries `aria-current`, the same word the tabs of the shell use, so
 * a screen reader says which view is open. The buttons are in the tab order, so
 * the keyboard needs no arrow keys to reach them.
 */

export type Segment = {
  id: string;
  label: string;
  /** A number or a word after the label, for a count. */
  note?: ReactNode;
};

type Props = {
  ariaLabel: string;
  items: readonly Segment[];
  current: string;
  onPick: (id: string) => void;
};

export function Segmented({ ariaLabel, items, current, onPick }: Props) {
  return (
    <div className="seg" role="group" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="seg-btn"
          aria-current={item.id === current ? "true" : undefined}
          onClick={() => {
            onPick(item.id);
          }}
        >
          {item.label}
          {item.note !== undefined && <span className="seg-note">{item.note}</span>}
        </button>
      ))}
    </div>
  );
}
