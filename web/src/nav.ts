/**
 * The six screens, in the order of the tab bar.
 *
 * A step of a run carries a number. The three reference screens carry no
 * number, because they are not a step of the run. The line between the two
 * groups comes from `divider`.
 */

export type TabId =
  | "intake"
  | "run"
  | "review"
  | "portfolio"
  | "library"
  | "voice";

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
  { id: "voice", label: "Voice" },
];

export const DEFAULT_TAB: TabId = "intake";

const IDS = new Set<string>(TABS.map((tab) => tab.id));

/** Say if the text is the name of a screen. */
export function isTabId(value: string): value is TabId {
  return IDS.has(value);
}