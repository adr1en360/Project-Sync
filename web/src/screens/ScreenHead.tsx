import type { ReactNode } from "react";

/**
 * The head of a screen: the title and one line that says what the screen is
 * for. Every screen has the same head, so a person always knows where they
 * are.
 */

type Props = {
  title: string;
  lede: ReactNode;
  children?: ReactNode;
};

export function ScreenHead({ title, lede, children }: Props) {
  return (
    <header className="screen-head">
      <h1>{title}</h1>
      <p className="screen-lede">{lede}</p>
      {children}
    </header>
  );
}