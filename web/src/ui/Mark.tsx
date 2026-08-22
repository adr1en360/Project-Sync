/**
 * The mark of a state.
 *
 * The four glyphs are the approved ones of this project. A mark is one of the
 * three channels of a state, and the other two are the word beside it and the
 * inversion of the row. So the mark is `aria-hidden`: the word carries the
 * meaning for a screen reader, and the glyph would only repeat it.
 */

export type MarkState = "pass" | "fail" | "hold" | "wait" | "work";

const GLYPH: Record<MarkState, string> = {
  pass: "\u2713",
  fail: "\u2715",
  hold: "\u25c6",
  wait: "\u00b7",
  work: "\u25c6",
};

type Props = {
  state: MarkState;
};

export function Mark({ state }: Props) {
  return (
    <span className={`mark mark-${state}`} aria-hidden="true">
      {GLYPH[state]}
    </span>
  );
}