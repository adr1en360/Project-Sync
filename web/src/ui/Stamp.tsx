import type { ReactNode } from "react";
import { Mark, type MarkState } from "./Mark";

/**
 * The verdict.
 *
 * The stamp is the loudest object of the interface, and it lands one time. The
 * word beside the mark carries the meaning.
 */

type Props = {
  state: MarkState;
  tone: "pass" | "fail" | "hold";
  children: ReactNode;
};

export function Stamp({ state, tone, children }: Props) {
  return (
    <p className={`stamp mark-${tone}`} role="status">
      <Mark state={state} />
      <span>{children}</span>
    </p>
  );
}