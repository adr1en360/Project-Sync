import type { ReactNode } from "react";

/**
 * A card.
 *
 * A card has a hairline border and no shadow. A card that answers the pointer
 * takes `live`, and then the border changes and nothing moves.
 */

type Props = {
  title?: ReactNode;
  /** A short text at the right of the title. */
  note?: ReactNode;
  live?: boolean;
  className?: string;
  children: ReactNode;
};

export function Card({ title, note, live = false, className, children }: Props) {
  const classes = ["card"];
  if (live) {
    classes.push("card-live");
  }
  if (className !== undefined) {
    classes.push(className);
  }

  return (
    <section className={classes.join(" ")}>
      {title !== undefined && (
        <header className="card-head">
          <h2 className="card-title">{title}</h2>
          {note !== undefined && <span className="card-note">{note}</span>}
        </header>
      )}
      {children}
    </section>
  );
}