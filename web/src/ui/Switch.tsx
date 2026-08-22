import type { ReactNode } from "react";

/**
 * A switch with two states.
 *
 * It is a button with `aria-pressed`, and not a checkbox, because it takes
 * effect at once and there is no form to send. The lamp is a second channel
 * beside the word, so the state does not depend on the colour.
 */

type Props = {
  pressed: boolean;
  onToggle: () => void;
  children: ReactNode;
  title?: string;
};

export function Switch({ pressed, onToggle, children, title }: Props) {
  return (
    <button
      type="button"
      className="switch"
      aria-pressed={pressed}
      onClick={onToggle}
      title={title}
    >
      <span className="switch-lamp" aria-hidden="true" />
      <span>{children}</span>
    </button>
  );
}