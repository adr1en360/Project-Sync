import { useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

/**
 * A labelled input.
 *
 * The label is joined to the input by an id, so a press on the label moves the
 * focus to the input. `useId` makes the id, so a screen can hold two fields
 * with the same name.
 *
 * The help text and the error text are joined by `aria-describedby`. An error
 * also sets `aria-invalid`.
 */

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: ReactNode;
  help?: ReactNode;
  error?: string | null;
  /** True for a repository path, a transaction id or other machine text. */
  mono?: boolean;
};

export function Field({
  label,
  help,
  error = null,
  mono = false,
  className,
  ...rest
}: Props) {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const described = [help === undefined ? null : helpId, error === null ? null : errorId]
    .filter((value): value is string => value !== null)
    .join(" ");

  const classes = ["field-input"];
  if (mono) {
    classes.push("field-mono");
  }
  if (className !== undefined) {
    classes.push(className);
  }

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        {...rest}
        id={id}
        className={classes.join(" ")}
        aria-invalid={error === null ? undefined : true}
        aria-describedby={described === "" ? undefined : described}
      />
      {help !== undefined && (
        <span className="field-help" id={helpId}>
          {help}
        </span>
      )}
      {error !== null && (
        <span className="field-error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}