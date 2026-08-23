import {
  Fragment,
  useCallback,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useHashRoute } from "./hooks/useHashRoute";
import { useHealth } from "./hooks/useHealth";
import { HUES, HUE_NUMBER, useTheme, type Hue, type Mode } from "./hooks/useTheme";
import { Intake } from "./screens/Intake";
import { Library } from "./screens/Library";
import { Portfolio } from "./screens/Portfolio";
import { Review } from "./screens/Review";
import { Run } from "./screens/Run";
import { TABS, type TabId } from "./nav";
import { Menu, type MenuItem } from "./ui/Menu";
import { Tag } from "./ui/Tag";
import { AutoIcon, MoonIcon, SunIcon } from "./ui/icons";

/**
 * The shell: the masthead, the five tabs, the two controls, and the canvas that
 * holds one screen.
 *
 * The masthead holds only what acts on every screen, which is the theme and the
 * accent colour. A control that acts on one screen lives on that screen. The
 * run screen owns its "Show more" control for this reason.
 *
 * There is no router. The tab is the state of the hash, so a link to one
 * screen works and the service needs no catch-all route. The hash also carries
 * the id of the transaction, which gives the automatic move from one step to the
 * next, a link to one run, and a reload that keeps its place, from one mechanism.
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
 * The control is an icon and no word, because the masthead holds the tabs, and
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

export default function App() {
  const { mode, hue, setHue, cycleMode } = useTheme();
  const { tab, param, go } = useHashRoute();
  const { health, error: healthError } = useHealth();

  /** What was said out loud after a move that a person did not ask for. */
  const [note, setNote] = useState("");

  /**
   * The run that is open.
   *
   * The id lives in the hash, and a tab press writes a hash with no id, so the
   * shell remembers the last one. Without this, a person who opens another tab
   * and comes back to the run screen loses the run they were watching.
   *
   * The first value comes from the address, so a link that a person pastes
   * opens its run. After that only an event writes it: the start of a run, or
   * the press of a tab. The address always wins while the run screen is open,
   * so the screen cannot show a run that the address does not name.
   */
  const [openTx, setOpenTx] = useState<string | null>(() =>
    tab === "run" ? param : null,
  );
  const txOnScreen = param ?? openTx;

  const announce = useCallback((text: string) => {
    setNote(text);
  }, []);

  /**
   * Open one of the three steps with the id of a run.
   *
   * Every move between the steps goes through here, so the id in the address, the
   * id that the shell remembers, and the sentence that is said out loud cannot
   * disagree. A sentence is given only for a move that a person did not ask for.
   * A person who pressed a control saw what they pressed, and a screen reader
   * must not read out a change that the person made.
   *
   * A tab press after the move wins, because it writes the hash last, and an
   * automatic move never fights a deliberate one.
   */
  const openFrom = useCallback(
    (where: "run" | "review", txId: string, said?: string) => {
      setOpenTx(txId);
      setNote(said ?? "");
      go(where, txId);
    },
    [go],
  );

  /**
   * The three steps carry the person, so a repository that the service accepts
   * opens the next step by itself, and the move is said out loud.
   */
  const startRun = useCallback(
    (txId: string) => {
      openFrom("run", txId, "The service accepted the repository. The run screen is open.");
    },
    [openFrom],
  );

  /**
   * The run screen decides the moment and this decides where, because only the
   * run screen knows that the state changed while the person watched.
   */
  const openReview = useCallback(
    (txId: string) => {
      openFrom(
        "review",
        txId,
        "The run is finished and it waits for you. The review desk is open.",
      );
    },
    [openFrom],
  );

  /**
   * One screen for each tab.
   *
   * The record is over the type of the tab, so the compiler fails the build if a
   * tab has no screen. This is the same rule that `labels.ts` follows for the
   * copy of each state.
   */
  const screen: Record<TabId, () => ReactNode> = {
    intake: () => <Intake onStarted={startRun} />,
    run: () => <Run txId={txOnScreen} announce={announce} onDone={openReview} />,
    review: () => <Review txId={txOnScreen} />,
    portfolio: () => <Portfolio />,
    // The screen of a tab is made only for the tab in the address, so the second
    // part of the hash here is the view of the library and nothing else.
    library: () => (
      <Library
        segment={param}
        onSegment={(name) => {
          go("library", name);
        }}
        onGo={openFrom}
      />
    ),
  };

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
                onClick={() =>
                  go(
                    item.id,
                    (item.id === "run" || item.id === "review") && txOnScreen !== null
                      ? txOnScreen
                      : undefined,
                  )
                }
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
          {/* A run in fixture mode costs no model call. A free run and a paid run
              look the same on the screen, and the free tier gives 20 requests a
              day, so the difference is said in the masthead. */}
          {health?.fixture_mode === true && (
            <span title="The service answers from a fixture. A run costs no model call.">
              <Tag tone="accent">No model calls</Tag>
            </span>
          )}

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
        {/* A move that a person did not ask for is said here, and nowhere else.
            The region is always in the page, because a region that arrives with
            its text is not read out. */}
        <p className="sr-only" role="status" aria-live="polite">
          {note}
        </p>

        {/* The key makes React put a new element here for each tab, and the
            `pane` class then plays the entry of the screen. */}
        <div className="pane" key={tab}>
          {screen[tab]()}
        </div>

        {/* Only a failure of the service is shown. A person cannot act on the
            model or on the configuration, so neither is reported. */}
        {healthError !== null && (
          <p className="field-error" role="alert" style={{ marginTop: "var(--sp-10)" }}>
            The service did not answer. {healthError}
          </p>
        )}
      </main>
    </div>
  );
}