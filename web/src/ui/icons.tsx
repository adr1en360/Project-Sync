/**
 * The icons of the masthead.
 *
 * Each icon is a small inline shape. It takes the colour of the text with
 * `currentColor`, and it is hidden from a screen reader, because the control
 * that holds it carries the words.
 */

const BOX = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

/** The machine chooses. A circle with one half filled. */
export function AutoIcon() {
  return (
    <svg {...BOX}>
      <circle cx="8" cy="8" r="5.6" />
      <path d="M8 2.4a5.6 5.6 0 0 1 0 11.2Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SunIcon() {
  return (
    <svg {...BOX}>
      <circle cx="8" cy="8" r="3.1" />
      <path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3.05 3.05l1.13 1.13M11.82 11.82l1.13 1.13M3.05 12.95l1.13-1.13M11.82 4.18l1.13-1.13" />
    </svg>
  );
}

export function MoonIcon() {
  return (
    <svg {...BOX}>
      <path d="M13.2 10.1A5.9 5.9 0 0 1 5.9 2.8 6.1 6.1 0 1 0 13.2 10.1Z" />
    </svg>
  );
}

/** The arrow of a menu. It points down, because the list opens under it. */
export function CaretIcon() {
  return (
    <svg {...BOX} width="10" height="10" viewBox="0 0 10 10">
      <path d="M2 4l3 3 3-3" />
    </svg>
  );
}