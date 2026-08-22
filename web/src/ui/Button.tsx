import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * A button.
 *
 * The type is `button` by default. A button inside a form sends the form if it
 * has no type, and no button of this interface sends a form by itself.
 *
 * `busy` disables the control and sets `aria-busy`, so a screen reader says
 * that the work is not finished.
 */

export type Tone = "primary" | "plain" | "quiet" | "danger";

const CLASS: Record<Tone, string> = {
  primary: "btn btn-primary",
  plain: "btn",
  quiet: "btn btn-quiet",
  danger: "btn btn-danger",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
  busy?: boolean;
  children: ReactNode;
};

export function Button({
  tone = "plain",
  busy = false,
  type = "button",
  className,
  disabled,
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      type={type}
      className={className === undefined ? CLASS[tone] : `${CLASS[tone]} ${className}`}
      disabled={disabled === undefined ? busy : disabled}
      aria-busy={busy ? true : undefined}
    >
      {children}
    </button>
  );
}