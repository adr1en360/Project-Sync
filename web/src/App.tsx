import {
  Fragment,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { getHealth } from "./api/client";
import { useHashRoute } from "./hooks/useHashRoute";
import { HUES, HUE_NUMBER, useTheme, type Hue, type Mode } from "./hooks/useTheme";
import { Intake } from "./screens/Intake";
import { Library } from "./screens/Library";
import { Portfolio } from "./screens/Portfolio";
import { Review } from "./screens/Review";
import { Run } from "./screens/Run";
import { Voice } from "./screens/Voice";
import { TABS, type TabId } from "./nav";
import { Menu, type MenuItem } from "./ui/Menu";
import { AutoIcon, MoonIcon, SunIcon } from "./ui/icons";

/**
 * The shell: the masthead, the six tabs, the two controls, and the canvas that
 * holds one screen.
 *
 * The masthead holds only what acts on every screen, which is the theme and the
 * accent colour. A control that acts on one screen lives on that screen. The
 * run screen owns its "Show more" control for this reason.
 *
 * There is no router. The tab is the state of the hash, so a link to one
 * screen works and the service needs no catch-all route.
 */

/** The sentence of the product. It is the same sentence as the submission. */
const TAGLINE = "Turn shipped code into career assets in one click";

const MODE_WORD: Record<Mode, string> = {
  system: "Follow the machine",
  light: "Light",
  dark: "Dark",
};

/**
 * The icon of each mode.
 *
 * The control is an icon and no word, because the masthead holds six tabs, and
 * the word was the widest thing in it. The mode is still in the name of the
 * button and in the tooltip, so nothing is lost to a screen reader or to a slow
 * pointer.
 */
const MODE_ICON: Record<Mode, () => ReactNode> = {
  system: () => <AutoIcon />,
  light: () => <SunIcon />,
  dark: () => <MoonIcon />,
};

const HUE_WORD: Record<Hue, string> = {
  azure: "Azure",
  violet: "Violet",
  rose: "Rose",
};

const HUE_ITEMS: readonly MenuItem[] = HUES.map((name) => ({
  id: name,
  label: HUE_WORD[name],
  hue: HUE_NUMBER[name],
}));

/**
 * One screen for each tab.
 *
 * The record is over the type of the tab, so the compiler fails the build if a
 * tab has no screen. This is the same rule that `labels.ts` follows for the
 * copy of each state.
 */
const SCREEN: Record<TabId, () => ReactNode> = {
  intake: () => <Intake />,
  run: () => <Run />,
  review: () => <Review />,
  portfolio: () => <Portfolio />,
  library: () => <Library />,
  voice: () => <Voice />,
};

export default function App() {
  const { mode, hue, setHue, cycleMode } = useTheme();
  const { tab, go } = useHashRoute();

  return (
    <div className="shell">
      <header className="masthead">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>ProjectSync</span>
          <span className="brand-quiet">{TAGLINE}</span>
        </div>

        <nav className="nav" aria-label="Screens">
          {TABS.map((item) => (
            <Fragment key={item.id}>
              {item.divider === true && (
                <span className="nav-divider" aria-hidden="true" />
              )}
              <button
                type="button"
                className="tab"
                aria-current={item.id === tab ? "page" : undefined}
                onClick={() => go(item.id)}
              >
                {item.step !== undefined && (
                  <span className="tab-index">{item.step}</span>
                )}
                {item.label}
              </button>
            </Fragment>
          ))}
        </nav>

        <div className="controls">
          <button
            type="button"
            className="btn btn-quiet btn-icon"
            onClick={cycleMode}
            aria-label={`Theme: ${MODE_WORD[mode]}`}
            title={`Theme: ${MODE_WORD[mode]}. Press for the next one.`}
          >
            {MODE_ICON[mode]()}
          </button>

          <Menu
            ariaLabel={`Accent colour: ${HUE_WORD[hue]}`}
            items={HUE_ITEMS}
            current={hue}
            onPick={(id) => {
              // The list holds the three names, so a value that is not one of
              // them cannot arrive. The search keeps the type without a cast.
              const next = HUES.find((name) => name === id);
              if (next !== undefined) {
                setHue(next);
              }
            }}
            trigger={
              <span
                className="hue-dot"
                aria-hidden="true"
                style={{ "--dot-h": HUE_NUMBER[hue] } as CSSProperties}
              />
            }
          />
        </div>
      </header>

      <main className="canvas">
        {/* The key makes React put a new element here for each tab, and the
            `pane` class then plays the entry of the screen. */}
        <div className="pane" key={tab}>
          {SCREEN[tab]()}
        </div>
        <ServiceLine />
      </main>
    </div>
  );
}

/**
 * The state of the service.
 *
 * Only a failure is shown, because a person cannot use the product if the
 * service is down. The model and the configuration were here until 2026-08-22,
 * behind a switch, and they told a person nothing they could act on. Stage F4
 * reads this same call again for the fixture badge, which is a fact a person
 * does act on, because it says whether a run costs a model call.
 */
function ServiceLine() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getHealth().then(
      () => {
        // The service answered. There is nothing to say.
      },
      (reason: unknown) => {
        if (live) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      },
    );
    return () => {
      live = false;
    };
  }, []);

  if (error === null) {
    return null;
  }

  return (
    <p className="field-error" role="alert" style={{ marginTop: "var(--sp-10)" }}>
      The service did not answer. {error}
    </p>
  );
}