/**
 * The shape of the data that comes after it.
 *
 * A skeleton takes the size of the real object, so the page does not jump when
 * the data arrives. There is no spinner in this interface.
 *
 * It is `aria-hidden`, because it holds no information. The surface that owns
 * it says `aria-busy` instead.
 */

type Props = {
  /** Any CSS length. The default fills the line. */
  width?: string;
  height?: string;
  radius?: string;
};

export function Skeleton({ width = "100%", height = "1rem", radius }: Props) {
  return (
    <span
      className="skeleton"
      aria-hidden="true"
      style={{ display: "block", width, height, borderRadius: radius }}
    />
  );
}