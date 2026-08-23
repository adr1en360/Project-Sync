import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBullet, deleteBullet, listBullets, updateBullet } from "../api/client";
import type { BulletTag, ResumeBullet } from "../api/types";

/**
 * The bullet bank of one person.
 *
 * The bank is read one time and it is filtered here. `store.list_bullets` reads
 * every bullet of the person from the database before it filters, so a filter on
 * the service costs the same and it adds one request for each press of a chip. A
 * filter that answers with no wait is worth more than a query that is smaller on
 * paper.
 *
 * A change goes to the service first and then into the list that is held here.
 * The list is not read again after a change, because the service answers with the
 * bullet that it wrote, and that answer is the truth of the row.
 */

/** The name that `busy` takes while a new bullet is written. */
export const NEW_ROW = "new";

/** What a person writes to change one bullet. */
export type Change = {
  text?: string;
  tags?: readonly BulletTag[];
  project?: string;
};

export type Bank = {
  /** Every bullet, newest first. Null while the first read runs. */
  rows: readonly ResumeBullet[] | null;
  /** The bullets that the filter keeps. */
  shown: readonly ResumeBullet[];
  /** The name of each project in the bank, in order. */
  projects: readonly string[];
  /** Only the tags that a bullet in the bank carries. */
  tags: readonly BulletTag[];
  project: string | null;
  chosen: readonly BulletTag[];
  loading: boolean;
  error: string | null;
  /** The bullet that a request is working on, or `NEW_ROW`, or null. */
  busy: string | null;
  setProject: (name: string | null) => void;
  toggleTag: (tag: BulletTag) => void;
  clear: () => void;
  reload: () => void;
  add: (text: string, project: string, tags: readonly BulletTag[]) => Promise<boolean>;
  save: (bulletId: string, change: Change) => Promise<boolean>;
  remove: (bulletId: string) => Promise<boolean>;
};

export function useBullets(userId = "default"): Bank {
  const [rows, setRows] = useState<readonly ResumeBullet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [project, setProject] = useState<string | null>(null);
  const [chosen, setChosen] = useState<readonly BulletTag[]>([]);
  const [turn, setTurn] = useState(0);

  const again = useRef<() => void>(() => {});

  useEffect(() => {
    let live = true;
    listBullets(userId)
      .then((got) => {
        if (!live) {
          return;
        }
        // A reply that is not a list is not a bank with no bullets. A proxy page
        // or a route that moved can answer with an object, and the screen must
        // say so instead of stopping.
        if (!Array.isArray(got)) {
          setError("The service did not answer with a list of bullets.");
          return;
        }
        setRows(got);
        setError(null);
      })
      .catch((why: unknown) => {
        if (live) {
          setError(why instanceof Error ? why.message : "The bank did not answer.");
        }
      });
    return () => {
      live = false;
    };
  }, [turn, userId]);

  again.current = useCallback(() => {
    setTurn((was) => was + 1);
  }, []);

  const reload = useCallback(() => {
    again.current();
  }, []);

  const projects = useMemo(() => {
    if (rows === null) {
      return [];
    }
    const found = new Set<string>();
    for (const row of rows) {
      if (row.project !== "") {
        found.add(row.project);
      }
    }
    return [...found].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  /**
   * The tags that the bank uses, and no others.
   *
   * The service holds fifteen tags. A row of fifteen chips is longer than the
   * screen and most of them would find nothing, so the filter offers only the
   * tags that a bullet carries.
   */
  const tags = useMemo(() => {
    if (rows === null) {
      return [];
    }
    const found = new Set<BulletTag>();
    for (const row of rows) {
      for (const tag of row.tags) {
        found.add(tag);
      }
    }
    return [...found].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  /**
   * The bullets that the filter keeps.
   *
   * A bullet must be in the chosen project, and it must carry one of the chosen
   * tags. One of, and not all of, because the service uses the same rule and the
   * two must agree.
   */
  const shown = useMemo(() => {
    if (rows === null) {
      return [];
    }
    return rows.filter((row) => {
      if (project !== null && row.project !== project) {
        return false;
      }
      if (chosen.length > 0 && !chosen.some((tag) => row.tags.includes(tag))) {
        return false;
      }
      return true;
    });
  }, [chosen, project, rows]);

  const toggleTag = useCallback((tag: BulletTag) => {
    setChosen((was) =>
      was.includes(tag) ? was.filter((one) => one !== tag) : [...was, tag],
    );
  }, []);

  const clear = useCallback(() => {
    setProject(null);
    setChosen([]);
  }, []);

  const add = useCallback(
    async (text: string, forProject: string, withTags: readonly BulletTag[]) => {
      setBusy(NEW_ROW);
      setError(null);
      try {
        const made = await createBullet(text, forProject, withTags, userId);
        // The service answers newest first, so a new bullet goes on the front.
        setRows((was) => (was === null ? [made] : [made, ...was]));
        return true;
      } catch (why: unknown) {
        setError(why instanceof Error ? why.message : "The bullet was not written.");
        return false;
      } finally {
        setBusy(null);
      }
    },
    [userId],
  );

  const save = useCallback(async (bulletId: string, change: Change) => {
    setBusy(bulletId);
    setError(null);
    try {
      const saved = await updateBullet(bulletId, change);
      setRows((was) =>
        was === null
          ? was
          : was.map((row) => (row.bullet_id === bulletId ? saved : row)),
      );
      return true;
    } catch (why: unknown) {
      setError(why instanceof Error ? why.message : "The change was not saved.");
      return false;
    } finally {
      setBusy(null);
    }
  }, []);

  const remove = useCallback(async (bulletId: string) => {
    setBusy(bulletId);
    setError(null);
    try {
      await deleteBullet(bulletId);
      setRows((was) =>
        was === null ? was : was.filter((row) => row.bullet_id !== bulletId),
      );
      return true;
    } catch (why: unknown) {
      setError(why instanceof Error ? why.message : "The bullet was not removed.");
      return false;
    } finally {
      setBusy(null);
    }
  }, []);

  return {
    rows,
    shown,
    projects,
    tags,
    project,
    chosen,
    loading: rows === null && error === null,
    error,
    busy,
    setProject,
    toggleTag,
    clear,
    reload,
    add,
    save,
    remove,
  };
}
