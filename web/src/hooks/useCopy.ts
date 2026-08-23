import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Copy a text, and say so on the control that did it.
 *
 * Animation 14 of the plan. The word in the button becomes "Copied" for a short
 * time and then it goes back. There is no message box, because a message box
 * covers the thing that a person copied.
 *
 * The hook holds the name of the last control that copied, and not a true or a
 * false, so a list of many controls needs one hook and each control asks if the
 * name is its own.
 *
 * A browser gives the clipboard only on a safe origin, and a person can refuse
 * the permission. Both give the same answer here: the copy failed, and the screen
 * says so instead of a confirmation that is not true.
 */

export type Copier = {
  /** The name of the control that copied, or null. */
  copied: string | null;
  /** Why the last copy failed, or null. */
  failed: string | null;
  copy: (name: string, text: string) => void;
};

/** How long the confirmation stays, in milliseconds. */
const HOLD = 1200;

export function useCopy(): Copier {
  const [copied, setCopied] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  // A component that goes away must not set the state of a component that is
  // gone, and a timer that nobody stops holds the test environment open.
  useEffect(
    () => () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    },
    [],
  );

  const copy = useCallback((name: string, text: string) => {
    const board: Clipboard | undefined = navigator.clipboard;
    if (board === undefined) {
      setFailed("This browser does not give the clipboard to the page.");
      return;
    }
    void board
      .writeText(text)
      .then(() => {
        setFailed(null);
        setCopied(name);
        if (timer.current !== null) {
          window.clearTimeout(timer.current);
        }
        timer.current = window.setTimeout(() => {
          setCopied(null);
        }, HOLD);
      })
      .catch(() => {
        setFailed("The browser did not give permission to copy.");
      });
  }, []);

  return { copied, failed, copy };
}
