import type { ResumeBullet } from "../api/types";

/**
 * The bullets of the bank, grouped by project repository.
 *
 * Grouping bullets per repository scan gives candidates a clean overview for resumes/CVs,
 * allowing full project bullet export in one click.
 */

export type Group = {
  /** The name of the project repository, or empty string for unassigned bullets. */
  project: string;
  rows: readonly ResumeBullet[];
};

/** Key identifier for copying an entire group to clipboard. */
export function groupKey(project: string): string {
  return `group:${project}`;
}

/** Format all bullets in a group as newline-delimited text ready for resume paste. */
export function groupText(group: Group): string {
  return group.rows.map((row) => row.text).join("\n");
}

/**
 * Group a flat array of bullets by their project name, preserving recency order.
 */
export function byProject(rows: readonly ResumeBullet[]): readonly Group[] {
  const order: string[] = [];
  const held = new Map<string, ResumeBullet[]>();

  for (const row of rows) {
    const kept = held.get(row.project);
    if (kept === undefined) {
      order.push(row.project);
      held.set(row.project, [row]);
    } else {
      kept.push(row);
    }
  }

  // Bullets with no project are placed last; others maintain latest-scan recency
  order.sort((a, b) => {
    if (a === b) {
      return 0;
    }
    return a === "" ? 1 : b === "" ? -1 : 0;
  });

  return order.map((project) => ({ project, rows: held.get(project) ?? [] }));
}
