import { Fragment, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { getHealth, type Health } from "./api/client";
import { useHashRoute } from "./hooks/useHashRoute";
import { useInternals } from "./hooks/useInternals";
import { HUES, HUE_NUMBER, useTheme, type Hue, type Mode } from "./hooks/useTheme";
import { Intake } from "./screens/Intake";
import { Library } from "./screens/Library";
import { Portfolio } from "./screens/Portfolio";
import { Review } from "./screens/Review";
import { Run } from "./screens/Run";
import { Voice } from "./screens/Voice";
import { TABS, type TabId } from "./nav";
import { Button } from "./ui/Button";
import { Switch } from "./ui/Switch";

/**
 * The shell: the masthead, the six tabs, the three controls, and the canvas
 * that holds one screen.
 *
 * There is no router. The tab is the state of the hash, so a link to one
 * screen works and the service needs no catch-all route.
 */

const MODE_WORD: Record<Mode, string> = {
  system: "Follow the machine",
  light: "Light",
  dark: "Dark",
};

const HUE_WORD: Record<Hue, string> = {
  azure: "Azure",
  violet: "Violet",
  rose: "Rose",
};

type ScreenProps = {
  internals: boolean;
};

/**
 * One screen for each tab.
 *
 * The record is over the type of the tab, so the compiler fails the build if a
 * tab has no screen. This is the same rule that `labels.ts` follows for the
 * copy of each state.
 */
const SCREEN: Record<TabId, (props: ScreenProps) => ReactNode> = {
  intake: () => <Intake />,
  run: () => <Run />,
  review: () => <Review />,
  portfolio: () => <Portfolio />,
  library: ({ internals }) => <Library internals={internals} />,
  voice: () => <Voice />,
};

export default function App() {
  const { mode, hue, setHue, cycleMode } = useTheme();
  const { internals, toggleInternals } = useInternals();
  const { tab, go } = useHashRoute();

  return (
    <div className="shell">
      <header className="masthead">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>ProjectSync</span>
          <span className="brand-quiet">the gate before you publish</span>
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
          <Button
            tone="quiet"
            onClick={cycleMode}
            title="Follow the machine, then light, then dark"
          >
            <span className="quiet">Theme</span> {MODE_WORD[mode]}
          </Button>

          <div className="hue-set" role="group" aria-label="Accent colour">
            {HUES.map((name) => (
              <button
                key={name}
                type="button"
                className="hue-dot"
                style={{ "--dot-h": HUE_NUMBER[name] } as CSSProperties}
                aria-pressed={name === hue}
                aria-label={HUE_WORD[name]}
                title={HUE_WORD[name]}
                onClick={() => setHue(name)}
              />
            ))}
          </div>

          <Switch
            pressed={internals}
            onToggle={toggleInternals}
            title="Show the name of each node of the graph and the time it took"
          >
            Internals
          </Switch>
        </div>
      </header>

      <main className="canvas">
        {/* The key makes React put a new element here for each tab, and the
            `pane` class then plays the entry of the screen. */}
        <div className="pane" key={tab}>
          {SCREEN[tab]({ internals })}
        </div>
        <ServiceLine internals={internals} />
      </main>
    </div>
  );
}

/**
 * The state of the service.
 *
 * A failure is shown to every person, because a person cannot use the product
 * if the service is down. The other numbers are for a person who asked for the
 * internals, so they sit inside the reveal.
 */
function ServiceLine({ internals }: ScreenProps) {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getHealth().then(
      (value) => {
        if (live) {
          setHealth(value);
        }
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

  if (error !== null) {
    return (
      <p className="field-error" role="alert" style={{ marginTop: "var(--sp-10)" }}>
        The service did not answer. {error}
      </p>
    );
  }

  return (
    <div
      className="reveal"
      data-open={internals ? "true" : "false"}
      aria-hidden={internals ? undefined : true}
    >
      <div className="reveal-body">
        <section
          aria-label="Service"
          className="mono faint"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--sp-4)",
            margin: "var(--sp-10) 0 0",
            fontSize: "var(--step--1)",
          }}
        >
          {health === null ? (
            <span>waiting for the service</span>
          ) : (
            <>
              <span>service {health.status}</span>
              <span>
                model <span>{health.model}</span>
              </span>
              <span>vertex {health.use_vertex_ai ? "on" : "off"}</span>
              <span>
                {health.missing_config.length === 0
                  ? "config complete"
                  : `missing ${health.missing_config.join(" ")}`}
              </span>
            </>
          )}
        </section>
      </div>
    </div>
  );
}