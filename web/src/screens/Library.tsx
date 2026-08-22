import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { ScreenHead } from "./ScreenHead";

/**
 * The bullet bank and the history.
 *
 * Stage F7 builds both views. The per-node timings of the history appear only
 * when the internals switch is on.
 *
 * The two cards of the main column sit in one grid, so the space between them
 * comes from the gap of that grid. An earlier version put the second card
 * outside the layout, where it had no space above it and it ran under the rail.
 */

type Props = {
  internals: boolean;
};

export function Library({ internals }: Props) {
  return (
    <>
      <ScreenHead
        title="Library"
        lede="Every resume bullet you kept, and every run you have made. Filter the bank by project or by tag."
      />

      <div className="layout">
        <div style={{ display: "grid", gap: "var(--sp-5)" }}>
          <EmptyState title="The bullet bank is empty">
            A bullet arrives here the first time you approve a run. Stage F7
            brings the bank, the filters and the inline edit.
          </EmptyState>

          <Card title="Social Studio" note="Stage F8">
            <p className="quiet" style={{ margin: 0 }}>
              The posts of a run are edited on the review desk. Studio is where
              you change the platform, the tone and the language, and write a new
              draft.
            </p>
          </Card>
        </div>

        <aside className="rail">
          <h2 className="card-title" style={{ fontSize: "var(--step-1)" }}>
            History
          </h2>
          <p className="quiet" style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--step--1)" }}>
            Every run, with its state and its repository.
          </p>
          {internals && (
            <p className="mono faint" style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--step--1)" }}>
              internals on: the time of each node will appear on every row
            </p>
          )}
        </aside>
      </div>
    </>
  );
}