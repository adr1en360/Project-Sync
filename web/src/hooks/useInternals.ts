import { useCallback, useState } from "react";
import { readChoice, writeChoice } from "./persist";

/**
 * The internals switch.
 *
 * Off, the interface reads as plain language. On, it shows the name of each
 * node of the graph and the time each node took.
 *
 * The switch is off at the first visit, so a person who came to see the
 * product sees the product.
 */

const KEY = "projectsync.internals";
const VALUES = ["on", "off"] as const;

export type InternalsState = {
  internals: boolean;
  toggleInternals: () => void;
};

export function useInternals(): InternalsState {
  const [internals, setInternals] = useState<boolean>(
    () => readChoice(KEY, VALUES, "off") === "on",
  );

  const toggleInternals = useCallback(() => {
    setInternals((current) => {
      writeChoice(KEY, current ? "off" : "on");
      return !current;
    });
  }, []);

  return { internals, toggleInternals };
}