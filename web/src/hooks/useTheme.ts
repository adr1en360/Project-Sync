import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { readChoice, withCrossFade, writeChoice } from "./persist";

/**
 * The mode and the accent preset.
 *
 * The mode has three values, and `system` is the default. A person who never
 * touches the control follows the machine. `tokens.css` answers the machine
 * with a media query and the person with `data-theme`, and the person wins.
 *
 * The preset writes `data-hue`, and that attribute changes one number: the hue
 * of the accent. The greys and the signal colours do not move.
 */

export const MODES = ["system", "light", "dark"] as const;
export const HUES = ["azure", "violet", "rose"] as const;

export type Mode = (typeof MODES)[number];
export type Hue = (typeof HUES)[number];

/** The hue of each preset in light mode, for the dots of the control. */
export const HUE_NUMBER: Record<Hue, number> = {
  azure: 258,
  violet: 300,
  rose: 333,
};

const MODE_KEY = "projectsync.mode";
const HUE_KEY = "projectsync.hue";

export type ThemeState = {
  mode: Mode;
  hue: Hue;
  setMode: (next: Mode) => void;
  setHue: (next: Hue) => void;
  /** Move to the next mode: system, then light, then dark. */
  cycleMode: () => void;
};

export function useTheme(): ThemeState {
  const [mode, setModeState] = useState<Mode>(() =>
    readChoice(MODE_KEY, MODES, "system"),
  );
  const [hue, setHueState] = useState<Hue>(() =>
    readChoice(HUE_KEY, HUES, "azure"),
  );

  // The attributes go on the root element, because `tokens.css` reads them
  // there. `system` writes no attribute, so the media query answers.
  useEffect(() => {
    const root = document.documentElement;
    if (mode === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", mode);
    }
  }, [mode]);

  useEffect(() => {
    const root = document.documentElement;
    if (hue === "azure") {
      root.removeAttribute("data-hue");
    } else {
      root.setAttribute("data-hue", hue);
    }
  }, [hue]);

  const setMode = useCallback((next: Mode) => {
    writeChoice(MODE_KEY, next);
    withCrossFade(() => setModeState(next), flushSync);
  }, []);

  const setHue = useCallback((next: Hue) => {
    writeChoice(HUE_KEY, next);
    // The hue sweeps by itself, because `--h` has a `@property` rule and
    // `motion.css` gives it a transition. A cross-fade would hide the sweep.
    setHueState(next);
  }, []);

  const cycleMode = useCallback(() => {
    setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]);
  }, [mode, setMode]);

  return { mode, hue, setMode, setHue, cycleMode };
}