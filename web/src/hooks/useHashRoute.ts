import { useCallback, useEffect, useState } from "react";
import { DEFAULT_TAB, isTabId, type TabId } from "../nav";

/**
 * The screen in the address of the page.
 *
 * There is no router. A tab is state, and the hash carries that state, so a
 * person can send a link to one screen. The hash also keeps the API safe:
 * `main.py` sends the page at the root path, and a path route would need a
 * catch-all that can hide `/api/v1/*`. A hash needs nothing from the service.
 *
 * The form is `#/<screen>` and `#/<screen>/<value>`. The value is the
 * transaction id on the run screen and the review screen.
 */

export type Route = {
  tab: TabId;
  /** The second part of the hash, or null. */
  param: string | null;
};

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const first = parts[0] ?? "";
  return {
    tab: isTabId(first) ? first : DEFAULT_TAB,
    param: parts[1] ?? null,
  };
}

export type RouteState = Route & {
  /** Go to a screen. Give a value for the second part of the hash. */
  go: (tab: TabId, param?: string) => void;
};

export function useHashRoute(): RouteState {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));

  // The event answers the back button and a hand-typed address.
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const go = useCallback((tab: TabId, param?: string) => {
    const next = param === undefined ? `#/${tab}` : `#/${tab}/${param}`;
    if (window.location.hash === next) {
      return;
    }
    // The write makes a `hashchange` event, and the listener above sets the
    // state. So the address and the screen cannot disagree.
    window.location.hash = next;
  }, []);

  return { ...route, go };
}