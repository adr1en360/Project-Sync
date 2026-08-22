import { useCallback, useState } from "react";
import { readChoice, writeChoice } from "./persist";

/**
 * The control that shows more about a run.
 *
 * Off, the run screen reads as plain language. On, it also shows the name of
 * each node of the graph, and from stage F4 the time each node took.
 *
 * The control belongs to the run screen and not to the masthead, because it
 * changes that one screen. It was in the masthead until 2026-08-22, where it
 * showed on six screens and did work for one.
 *
 * The choice is kept, so a person who wants the detail does not ask twice. It
 * is off at the first visit, so a person who came to see the product sees the
 * product.
 */

const KEY = "projectsync.showmore";
const VALUES = ["on", "off"] as const;

export type ShowMoreState = {
  more: boolean;
  toggleMore: () => void;
};

export function useShowMore(): ShowMoreState {
  const [more, setMore] = useState<boolean>(
    () => readChoice(KEY, VALUES, "off") === "on",
  );

  const toggleMore = useCallback(() => {
    setMore((current) => {
      writeChoice(KEY, current ? "off" : "on");
      return !current;
    });
  }, []);

  return { more, toggleMore };
}