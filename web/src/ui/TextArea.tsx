import { useId } from "react";
import type { ReactNode, TextareaHTMLAttributes } from "react";

/**
 * A labelled box for text of more than one line.
 *
 * It is the same contract as `Field`, because a person must not have to learn
 * two. The box grows and shrinks by hand, and it never grows the page by itself,
 * so a folio of four drafts holds still while a person reads it.
 */

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  label: ReactNode;
  help?: ReactNode;
  error?: string | null;
  /** True for markdown, a repository path, or other machine text. */
  mono?: boolean;
};

export function TextArea({
  label,
  help,
  error = null,
  mono = false,
  rows = 6,
  className,
  ...rest
}: Props) {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const described = [help === undefined ? null : helpId, error === null ? null : errorId]
    .filter((value): value is string => value !== null)
    .join(" ");

  const classes = ["field-input", "field-area"];
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
      <textarea
        {...rest}
        id={id}
        rows={rows}
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
