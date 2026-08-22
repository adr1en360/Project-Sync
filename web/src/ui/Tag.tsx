import type { ReactNode } from "react";

/**
 * A tag.
 *
 * This is the one pill shape of the interface. A tag always holds a word, so
 * the colour is never the only channel of the meaning.
 */

export type TagTone = "pass" | "fail" | "hold" | "accent" | "quiet";

type Props = {
  tone?: TagTone;
  children: ReactNode;
};

export function Tag({ tone = "quiet", children }: Props) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}