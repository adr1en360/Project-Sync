/**
 * The five screens, in the order of the tab bar.
 *
 * A step of a run carries a number. The two reference screens carry no number,
 * because they are not a step of the run. The line between the two groups comes
 * from `divider`.
 *
 * The voice rules had a tab of their own. Everything that tab did was enable,
 * edit and remove on one list, which is what the library already is, so the
 * rules are a view of the library now. A tab is for a place a person goes, and
 * not for every object the service holds.
 */

export type TabId =
  | "intake"
  | "run"
  | "review"
  | "portfolio"
  | "library";

export type Tab = {
  id: TabId;
  label: string;
  /** The number of the step, for the three steps of a run. */
  step?: number;
  /** True if a line goes before this tab. */
  divider?: boolean;
};

export const TABS: readonly Tab[] = [
  { id: "intake", label: "Intake", step: 1 },
  { id: "run", label: "Run", step: 2 },
  { id: "review", label: "Review", step: 3 },
  { id: "portfolio", label: "Portfolio", divider: true },
  { id: "library", label: "Library" },
];

export const DEFAULT_TAB: TabId = "intake";

const IDS = new Set<string>(TABS.map((tab) => tab.id));

/** Say if the text is the name of a screen. */
export function isTabId(value: string): value is TabId {
  return IDS.has(value);
}