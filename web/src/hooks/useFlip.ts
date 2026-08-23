import { useLayoutEffect, useRef } from "react";

/**
 * The reflow of the gallery (animation 9).
 *
 * A filter or a sort puts every card in a new place at one step. The eye cannot
 * follow a jump, so this hook reads where each card was, lets the browser lay
 * the cards out again, and then moves each card from its old place to its new
 * one. Only `transform` moves, so the browser measures the page one time.
 *
 * Each card carries `data-flip` with a name that lives longer than its place in
 * the list. Without that name there is no way to know which card went where.
 */
export function useFlip(key: string) {
  const host = useRef<HTMLDivElement | null>(null);
  const boxes = useRef(new Map<string, DOMRect>());

  useLayoutEffect(() => {
    const node = host.current;
    if (node === null) {
      return;
    }

    const still =
      typeof window.matchMedia !== "function"
        ? false
        : window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const next = new Map<string, DOMRect>();
    for (const card of node.querySelectorAll<HTMLElement>("[data-flip]")) {
      const id = card.dataset.flip;
      if (id === undefined) {
        continue;
      }
      const now = card.getBoundingClientRect();
      next.set(id, now);

      const was = boxes.current.get(id);
      // A card that was not on the screen before arrives by the entry stagger,
      // and a person who asks for less movement gets none.
      if (was === undefined || still) {
        continue;
      }
      const dx = was.left - now.left;
      const dy = was.top - now.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
        continue;
      }
      // `animate` is absent in the test environment. A card that does not move
      // is already in the right place, so this is not a failure.
      if (typeof card.animate !== "function") {
        continue;
      }
      card.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
        {
          duration: msOf(node, "--dur-base", 240),
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        },
      );
    }
    boxes.current = next;
  }, [key]);

  return host;
}

/** Read one duration token as a number of milliseconds. */
function msOf(node: HTMLElement, name: string, fallback: number): number {
  const text = getComputedStyle(node).getPropertyValue(name).trim();
  const value = Number.parseFloat(text);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
