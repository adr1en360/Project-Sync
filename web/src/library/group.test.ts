import { describe, expect, it } from "vitest";
import type { ResumeBullet } from "../api/types";
import { byProject, groupKey, groupText, type Group } from "./group";

function makeBullet(id: string, project: string, text: string, created: string): ResumeBullet {
  return {
    bullet_id: id,
    user_id: "default",
    project,
    text,
    tags: [],
    source_tx_id: "tx-1",
    is_manual_edit: false,
    created_at: created,
  };
}

describe("group bullets by project", () => {
  it("handles empty bullet list", () => {
    const groups = byProject([]);
    expect(groups).toEqual([]);
  });

  it("groups bullets under single project keeping order", () => {
    const bullets: ResumeBullet[] = [
      makeBullet("b1", "project-sync", "Bullet 1", "2026-08-24T12:00:00Z"),
      makeBullet("b2", "project-sync", "Bullet 2", "2026-08-24T11:00:00Z"),
    ];
    const groups = byProject(bullets);
    expect(groups).toHaveLength(1);
    expect(groups[0].project).toBe("project-sync");
    expect(groups[0].rows).toHaveLength(2);
  });

  it("groups multiple projects and places empty project names last", () => {
    const bullets: ResumeBullet[] = [
      makeBullet("b1", "", "Unassigned 1", "2026-08-24T15:00:00Z"),
      makeBullet("b2", "crucible", "Crucible bullet", "2026-08-24T14:00:00Z"),
      makeBullet("b3", "project-sync", "Sync bullet", "2026-08-24T13:00:00Z"),
      makeBullet("b4", "crucible", "Crucible bullet 2", "2026-08-24T12:00:00Z"),
    ];
    const groups = byProject(bullets);
    expect(groups.map((g) => g.project)).toEqual(["crucible", "project-sync", ""]);
    expect(groups[0].rows).toHaveLength(2);
    expect(groups[1].rows).toHaveLength(1);
    expect(groups[2].rows).toHaveLength(1);
  });

  it("formats groupText with newline separation", () => {
    const group: Group = {
      project: "crucible",
      rows: [
        makeBullet("b1", "crucible", "First line.", "2026-08-24T12:00:00Z"),
        makeBullet("b2", "crucible", "Second line.", "2026-08-24T11:00:00Z"),
      ],
    };
    expect(groupText(group)).toBe("First line.\nSecond line.");
  });

  it("generates stable groupKey", () => {
    expect(groupKey("project-sync")).toBe("group:project-sync");
  });
});
