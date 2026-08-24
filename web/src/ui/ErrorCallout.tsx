import type { CSSProperties, ReactNode } from "react";
import { humanizeError } from "../format";

/**
 * A contained error callout.
 *
 * Displays error messages inside a contained, bounded box with proper line
 * wrapping, subtle background tinting, and optional technical explanation
 * without blowing out horizontal layout containers.
 */

type Props = {
  /** The error text or object from the service. */
  error: unknown;
  /** Optional title override. */
  title?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function ErrorCallout({ error, title, className, style }: Props) {
  if (error == null || error === "") {
    return null;
  }

  const raw =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : String(error);

  if (raw.trim() === "") {
    return null;
  }

  const { message, technical } = humanizeError(raw);

  const classes = ["error-callout"];
  if (className !== undefined) {
    classes.push(className);
  }

  return (
    <div className={classes.join(" ")} role="alert" style={style}>
      <svg
        className="error-callout-icon"
        viewBox="0 0 16 16"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6.5" />
        <line x1="8" y1="5" x2="8" y2="8.5" />
        <circle cx="8" cy="11.5" r="0.5" fill="currentColor" />
      </svg>
      <div className="error-callout-content">
        <p className="error-callout-msg">{title ?? message}</p>
        {technical !== undefined && (
          <p className="error-callout-tech">{technical}</p>
        )}
      </div>
    </div>
  );
}
