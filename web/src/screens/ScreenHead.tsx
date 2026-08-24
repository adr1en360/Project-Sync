import type { ReactNode } from "react";

/**
 * The head of a screen: the title and one line that says what the screen is
 * for. Every screen has the same head, so a person always knows where they
 * are.
 */

type Props = {
  title: string;
  lede: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
};

export function ScreenHead({ title, lede, actions, children }: Props) {
  return (
    <header className="screen-head">
      <div className="screen-head-text">
        <h1>{title}</h1>
        <p className="screen-lede">{lede}</p>
      </div>
      {actions !== undefined && <div className="screen-head-actions">{actions}</div>}
      {children}
    </header>
  );
}