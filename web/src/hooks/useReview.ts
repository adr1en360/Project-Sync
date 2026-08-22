import { useCallback, useMemo, useState } from "react";
import { approveRun, rejectRun } from "../api/client";
import {
  DECIDABLE_STATUS,
  RETRYABLE_STATUS,
  type ApprovalResult,
  type GeneratedAssets,
  type Transaction,
} from "../api/types";

/**
 * The four drafts while a person reads them, and the one decision at the end.
 *
 * The hook holds the changes of the person and not a copy of the drafts. The
 * drafts of the service stay the base, and what the person typed sits over the
 * top of them. So a new read of the row does not throw away what they typed,
 * a change of run does not carry an edit from the run before it, and no effect
 * has to keep a copy the same as a prop.
 *
 * `canDecide` and `canRetry` are the gate of the client. `routes/phase2.py` has
 * no gate on the status of the row, so it would accept a second approval of a
 * run that is already committed and write the two commits again. The interface
 * holds that gate, the same way it holds the gate on cancel.
 */

/**
 * The four drafts as a person edits them.
 *
 * Each list of a draft is one text with one item on each line. A list of fields
 * with a control to add a row and a control to remove one is more machine for
 * the same result, and a person at a gate wants to type and not to manage rows.
 * An empty line goes out when the text becomes a list again, so a person can
 * leave a gap while they think.
 */
export type Draft = {
  doc_sheet_md: string;
  card_title: string;
  card_tagline: string;
  card_stack: string;
  card_highlights: string;
  card_repo_url: string;
  resume_bullets: string;
  social_draft: string;
};

/** Make the lines of a text into a list, with no empty line in it. */
export function listOf(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/** Open the drafts of the service for editing. */
export function draftOf(assets: GeneratedAssets): Draft {
  const card = assets.portfolio_card;
  return {
    doc_sheet_md: assets.doc_sheet_md,
    card_title: card.title,
    card_tagline: card.tagline,
    card_stack: card.stack.join("\n"),
    card_highlights: card.highlights.join("\n"),
    card_repo_url: card.repo_url,
    resume_bullets: assets.resume_bullets.join("\n"),
    social_draft: assets.social_draft,
  };
}

/** Close the drafts into the shape that Phase 2 accepts. */
export function assetsOf(draft: Draft): GeneratedAssets {
  return {
    doc_sheet_md: draft.doc_sheet_md,
    portfolio_card: {
      title: draft.card_title,
      tagline: draft.card_tagline,
      stack: listOf(draft.card_stack),
      highlights: listOf(draft.card_highlights),
      repo_url: draft.card_repo_url,
    },
    resume_bullets: listOf(draft.resume_bullets),
    social_draft: draft.social_draft,
  };
}

export type ReviewState = {
  /** The drafts as they read now, or null when this run has none. */
  draft: Draft | null;
  /** Write one part of the drafts. */
  set: (part: Partial<Draft>) => void;
  /** True when what the person typed is not what the service sent. */
  edited: boolean;
  /** Throw away the changes of the person and read the service again. */
  undo: () => void;
  canDecide: boolean;
  canRetry: boolean;
  busy: boolean;
  /** The answer of the decision, while this run is on the screen. */
  result: ApprovalResult | null;
  error: string | null;
  approve: () => void;
  reject: () => void;
};

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export function useReview(tx: Transaction | null, refresh: () => void): ReviewState {
  const [edit, setEdit] = useState<{ key: string; parts: Partial<Draft> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ id: string; result: ApprovalResult } | null>(
    null,
  );
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null);

  const id = tx?.tx_id ?? "";

  // The changes belong to one run and to one version of its drafts. An approval
  // with an edit writes a new version, and the service then holds what the
  // person typed, so the changes over the top of it must go.
  const key = tx === null ? "" : `${tx.tx_id}:${tx.asset_versions.length}`;

  const assets = tx?.assets ?? null;
  const base = useMemo(() => (assets === null ? null : draftOf(assets)), [assets]);
  const mine = edit !== null && edit.key === key ? edit.parts : null;

  const draft = useMemo(
    () => (base === null ? null : { ...base, ...mine }),
    [base, mine],
  );

  const edited =
    base !== null &&
    mine !== null &&
    Object.entries(mine).some(([name, value]) => value !== base[name as keyof Draft]);

  const set = useCallback(
    (part: Partial<Draft>) => {
      setEdit((last) => ({
        key,
        parts: { ...(last !== null && last.key === key ? last.parts : {}), ...part },
      }));
    },
    [key],
  );

  const undo = useCallback(() => setEdit(null), []);

  const decide = useCallback(
    (approved: boolean) => {
      if (tx === null) {
        return;
      }
      const run = tx.tx_id;
      setBusy(true);
      setFailure(null);
      const call = approved
        ? approveRun(run, edited && draft !== null ? assetsOf(draft) : null)
        : rejectRun(run);
      call.then(
        (result) => {
          setBusy(false);
          setAnswer({ id: run, result });
          // The row now holds another status, and up to two commit values, and
          // the poll of the run stopped when the run left RUNNING.
          refresh();
        },
        (reason: unknown) => {
          setBusy(false);
          setFailure({ id: run, message: messageOf(reason) });
          refresh();
        },
      );
    },
    [tx, edited, draft, refresh],
  );

  const approve = useCallback(() => decide(true), [decide]);
  const reject = useCallback(() => decide(false), [decide]);

  const status = tx?.status ?? null;
  const has = assets !== null;

  return {
    draft,
    set,
    edited,
    undo,
    canDecide: has && status === DECIDABLE_STATUS,
    canRetry: has && status === RETRYABLE_STATUS,
    busy,
    // The answer and the failure name their run, so neither one is shown for a
    // run that the address does not name.
    result: answer !== null && answer.id === id ? answer.result : null,
    error: failure !== null && failure.id === id ? failure.message : null,
    approve,
    reject,
  };
}
