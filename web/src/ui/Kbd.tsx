import type { ReactNode } from "react";

/** A key of the keyboard, in the text of the page. */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd>{children}</kbd>;
}