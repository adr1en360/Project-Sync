/**
 * The store of the choices of a person.
 *
 * The three choices of the interface are the mode, the accent preset and the
 * "Show more" control. Each one goes in `localStorage`, so the choice comes back
 * after a reload.
 *
 * Every call is inside a `try`. A browser can refuse storage in a private
 * window, and a refused write must not stop the interface.
 */

/** Read a stored choice. Give the fallback if the value is not one of the
 * allowed ones. */
export function readChoice<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  try {
    const value = window.localStorage.getItem(key);
    if (value !== null && (allowed as readonly string[]).includes(value)) {
      return value as T;
    }
  } catch {
    // Storage is not available. The fallback is correct.
  }
  return fallback;
}

/** Write a choice. Do nothing if the browser refuses. */
export function writeChoice(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage is not available. The interface still works for this visit.
  }
}

/** Say if the machine asks for less movement. */
export function prefersLessMotion(): boolean {
  if (typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Make a change of the page inside a view transition.
 *
 * The browser makes an image of the page before the change and an image after
 * it, and it fades between the two. `flushSync` is necessary, because the
 * browser takes the second image when the callback ends and React must have
 * written the DOM by then.
 *
 * A browser with no support runs the change directly, and the colour
 * transitions in `motion.css` cover the swap.
 */
export function withCrossFade(apply: () => void, flush: (fn: () => void) => void): void {
  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => unknown;
  };
  if (typeof doc.startViewTransition !== "function" || prefersLessMotion()) {
    apply();
    return;
  }
  doc.startViewTransition(() => {
    flush(apply);
  });
}