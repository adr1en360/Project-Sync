import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listTransactions } from "../api/client";
import type { PortfolioCard, Transaction, TransactionStatus } from "../api/types";

/**
 * The cards of the gallery, and the choice of a person.
 *
 * There is no endpoint for a card. A card lives inside the newest asset version
 * of a run, and the service computes the `assets` field from that version, so
 * the history is the source of the gallery.
 *
 * The service takes one status for each request, and a card sits on a row that
 * is COMPLETED and on a row that is PARTIAL. So this hook asks for no status and
 * keeps the rows itself. That is one request and not two.
 */

/**
 * The states in which a run holds a card that a person approved.
 *
 * A run that waits for a person has a card too, and it is not here on purpose.
 * The gate is the product, so a draft that nobody approved is not finished work.
 */
const APPROVED: readonly TransactionStatus[] = ["COMPLETED", "PARTIAL"];

/** One card, and the run that made it. */
export type CardItem = {
  txId: string;
  repoName: string;
  createdAt: string | null;
  status: TransactionStatus;
  card: PortfolioCard;
};

export const SORTS = ["newest", "name"] as const;

export type Sort = (typeof SORTS)[number];

export const SORT_LABEL: Record<Sort, string> = {
  newest: "Newest first",
  name: "By name",
};

/** Take the cards out of the history, newest first. */
function itemsOf(rows: readonly Transaction[]): CardItem[] {
  const out: CardItem[] = [];
  for (const row of rows) {
    if (!APPROVED.includes(row.status)) {
      continue;
    }
    const card = row.assets === null ? null : row.assets.portfolio_card;
    // A version can hold a card with no title if one draft came back empty, and
    // a card with no title has nothing to show. So the title is the test.
    if (card === null || card === undefined || card.title === "") {
      continue;
    }
    out.push({
      txId: row.tx_id,
      repoName: row.repo_name,
      createdAt: row.created_at,
      status: row.status,
      card,
    });
  }
  return out;
}

export type Gallery = {
  items: readonly CardItem[];
  /** The cards that the filter and the sort leave on the screen. */
  shown: readonly CardItem[];
  /** The cards that go into the deck. */
  chosen: readonly CardItem[];
  techs: readonly string[];
  tech: string | null;
  sort: Sort;
  picked: readonly string[];
  loading: boolean;
  error: string | null;
  setTech: (name: string | null) => void;
  setSort: (order: Sort) => void;
  toggle: (txId: string) => void;
  clear: () => void;
  reload: () => void;
};

export function usePortfolio(userId = "default"): Gallery {
  const [rows, setRows] = useState<readonly Transaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tech, setTech] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("newest");
  const [wanted, setWanted] = useState<readonly string[]>([]);
  const again = useRef<() => void>(() => {});

  useEffect(() => {
    let live = true;

    function read() {
      listTransactions(userId)
        .then((got) => {
          if (!live) {
            return;
          }
          // A reply that is not a list is not a gallery with no cards. A proxy
          // page or a route that moved can answer with an object, and a screen
          // must say so instead of stopping.
          if (!Array.isArray(got)) {
            setError("The service did not answer with a list of runs.");
            return;
          }
          setRows(got);
          setError(null);
        })
        .catch((wrong: unknown) => {
          if (live) {
            setError(wrong instanceof Error ? wrong.message : "The service did not answer.");
          }
        });
    }

    again.current = read;
    read();
    return () => {
      live = false;
    };
  }, [userId]);

  const reload = useCallback(() => {
    again.current();
  }, []);

  const items = useMemo(() => (rows === null ? [] : itemsOf(rows)), [rows]);

  const techs = useMemo(() => {
    const seen = new Set<string>();
    for (const item of items) {
      for (const name of item.card.stack) {
        seen.add(name);
      }
    }
    return [...seen].sort((one, two) => one.localeCompare(two));
  }, [items]);

  const shown = useMemo(() => {
    const kept =
      tech === null ? items : items.filter((item) => item.card.stack.includes(tech));
    // The service answers newest first, so that order needs no work here.
    if (sort === "name") {
      return [...kept].sort((one, two) => one.card.title.localeCompare(two.card.title));
    }
    return kept;
  }, [items, sort, tech]);

  /**
   * The choice, less any card that the filter hides.
   *
   * The filter is a view and not a delete. A person who chooses three cards, then
   * looks at one thing, then clears the filter, gets their three cards back.
   *
   * This is derived and it is not held in state. State would need an effect to
   * correct it after each change of the filter, and an effect that corrects a
   * render is a second render for nothing.
   */
  const picked = useMemo(
    () => wanted.filter((id) => shown.some((item) => item.txId === id)),
    [shown, wanted],
  );

  /**
   * The cards of the deck.
   *
   * No choice means every card that the filter leaves. That is what makes the
   * two controls different: a person who knows the three they want selects them,
   * and a person who does not select nothing and answers one card at a time in
   * the deck.
   */
  const chosen = useMemo(
    () => (picked.length === 0 ? shown : shown.filter((item) => picked.includes(item.txId))),
    [picked, shown],
  );

  const toggle = useCallback((txId: string) => {
    setWanted((was) =>
      was.includes(txId) ? was.filter((one) => one !== txId) : [...was, txId],
    );
  }, []);

  const clear = useCallback(() => {
    setWanted([]);
  }, []);

  return {
    items,
    shown,
    chosen,
    techs,
    tech,
    sort,
    picked,
    loading: rows === null && error === null,
    error,
    setTech,
    setSort,
    toggle,
    clear,
    reload,
  };
}
