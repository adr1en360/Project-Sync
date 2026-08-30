import { useLayoutEffect, useRef, useState } from "react";
import type { ApprovalResult, PathRecommendation } from "../api/types";
import { useReview } from "../hooks/useReview";
import { useRules } from "../hooks/useRules";
import { useTransaction } from "../hooks/useTransaction";
import { RuleRow } from "../library/RuleRow";
import {
  PUBLISH_PATH,
  PUBLISH_PATH_NOTE,
  PUBLISH_PATH_TONE,
  STATUS,
  STATUS_TONE,
} from "../labels";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { ErrorCallout } from "../ui/ErrorCallout";
import { Field } from "../ui/Field";
import { Skeleton } from "../ui/Skeleton";
import { Stamp } from "../ui/Stamp";
import { Tag } from "../ui/Tag";
import { TextArea } from "../ui/TextArea";
import { ScreenHead } from "./ScreenHead";

/**
 * The gate.
 *
 * This is the one screen where a person changes what the models wrote, and the
 * one place where anything leaves the service. So the order of it is the order of
 * the decision: read the check first, then read the four drafts and change them,
 * then decide. The rail holds the voice, because a change to a draft is one run
 * and a rule is every run after it.
 *
 * The two controls of a decision are on the screen in one state of the row only.
 * `routes/phase2.py` holds no gate on the status, so it would take a second
 * approval of a run that is already committed and write the two commits twice.
 */

/**
 * The five numbers of the pile. Every one of them is here, and no other file holds
 * a length or a wait for this animation, so one place changes the whole feel.
 *
 * The total is `(cards - 1) * LAND_STEP + LAND_DUR + HOLD + ARRANGE_DUR`, which is
 * near 1900ms for six cards. That is long for a page, and it is deliberate: this
 * screen is the one a person watches, so the pile must be readable while it builds
 * and not only after it stops.
 */

/**
 * How far each card of the pile sits below the card before it, in pixels.
 *
 * The pile must build downward, so a card cannot land exactly on the card before
 * it. A small step leaves the edge and the title of every card in the pile
 * visible while the pile builds.
 */
const SHINGLE = 16;

/** How long one card waits after the card before it started to arrive, in ms. */
const LAND_STEP = 120;

/** How long one card takes to arrive on the pile, in milliseconds. */
const LAND_DUR = 340;

/** How long the finished pile waits before it opens, in milliseconds. */
const HOLD = 140;

/** How long the pile takes to open into the column, in milliseconds. */
const ARRANGE_DUR = 860;

type Props = {
  /** The run that the address names, or null. */
  txId: string | null;
};

/** How much of the check to believe, in words a person can act on. */
function Verdict({ verdict }: { verdict: PathRecommendation }) {
  const tone = PUBLISH_PATH_TONE[verdict.recommendation];
  const percent = Math.round(verdict.confidence * 100);

  return (
    <Card title="The safety check">
      <Stamp state={tone} tone={tone}>
        {PUBLISH_PATH[verdict.recommendation]}
      </Stamp>
      <p className="quiet">{PUBLISH_PATH_NOTE[verdict.recommendation]}</p>

      {verdict.reasons.length > 0 && (
        <>
          <h3 className="folio-sub">Why it says that</h3>
          <ul className="plain-list">
            {verdict.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </>
      )}

      {verdict.missing_elements.length > 0 && (
        <>
          <h3 className="folio-sub">What it could not find</h3>
          <ul className="plain-list">
            {verdict.missing_elements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}

      <p className="faint">
        Confidence {percent} of 100. The check is advice and not a gate. You decide.
      </p>
    </Card>
  );
}

/** What the service wrote, and what it could not write. */
function Receipt({ result }: { result: ApprovalResult }) {
  const rows: { term: string; value: string; bad: boolean }[] = [];
  const add = (term: string, sha: string | null | undefined, error: string | null | undefined) => {
    if (sha !== null && sha !== undefined && sha !== "") {
      rows.push({ term, value: sha, bad: false });
    } else if (error !== null && error !== undefined && error !== "") {
      rows.push({ term, value: error, bad: true });
    }
  };
  add("Document sheet", result.doc_commit_sha, result.doc_error);
  add("Portfolio card", result.card_commit_sha, result.card_error);

  return (
    <div className="receipt">
      <p className="receipt-head">
        <Tag tone={STATUS_TONE[result.status]}>{STATUS[result.status]}</Tag>
      </p>

      {rows.length > 0 && (
        <dl className="pair-list">
          {rows.map((row) => (
            <div key={row.term} style={{ display: "contents" }}>
              <dt>{row.term}</dt>
              <dd className={row.bad ? "field-error" : "mono"}>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {result.proposed_rules !== undefined && result.proposed_rules.length > 0 && (
        <>
          <h3 className="folio-sub">The curator suggests</h3>
          <ul className="plain-list">
            {result.proposed_rules.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
          <p className="faint">
            Each one is off until you turn it on. They are in the rail on the right.
          </p>
        </>
      )}
    </div>
  );
}

export function Review({ txId }: Props) {
  const { tx, error: runError, loading, refresh } = useTransaction(txId);
  const review = useReview(tx, refresh);
  const rules = useRules();
  const [text, setText] = useState("");

  const { draft } = review;
  const open = review.canDecide || review.canRetry;
  const applied = new Set(tx?.style_rules_applied ?? []);

  const keep = () => {
    const clean = text.trim();
    if (clean === "") {
      return;
    }
    void rules.add(clean).then((made) => {
      if (made) {
        setText("");
      }
    });
  };

  const stack = useRef<HTMLDivElement>(null);
  const arranged = draft !== null;

  /**
   * Give the pile its numbers.
   *
   * A card must start at the top of the column and not at its own place, and only
   * the browser knows how far that is, because the height of a card comes from the
   * text inside it. So the distance is measured here and `motion.css` reads it.
   *
   * The measurement is safe while the animation runs, because `offsetTop` is a
   * result of the layout and `transform` does not change the layout.
   *
   * The card that is last in the order arrives last, so it lands on the top of the
   * pile. That is `Your decision`, and it is the card a person acts on.
   */
  useLayoutEffect(() => {
    const host = stack.current;
    if (host === null || !arranged) {
      return;
    }

    const cards = Array.from(host.children).filter(
      (node): node is HTMLElement => node instanceof HTMLElement,
    );
    if (cards.length === 0) {
      return;
    }

    const head = cards[0].offsetTop;
    cards.forEach((card, index) => {
      const lift = card.offsetTop - head - index * SHINGLE;
      card.style.setProperty("--lift", `${Math.max(0, Math.round(lift))}px`);
      card.style.setProperty("--land", `${index * LAND_STEP}ms`);
      card.style.zIndex = String(index + 1);
    });

    // Every card leaves the pile together, so the pile opens as one thing. The
    // wait is the time the last card needs to finish its arrival, and a short hold
    // after it, so the pile is whole for a moment before it moves.
    const last = (cards.length - 1) * LAND_STEP + LAND_DUR;
    host.style.setProperty("--arrange", `${last + HOLD}ms`);
    host.style.setProperty("--land-dur", `${LAND_DUR}ms`);
    host.style.setProperty("--arrange-dur", `${ARRANGE_DUR}ms`);
  }, [arranged, txId]);

  return (
    <>
      <ScreenHead
        title="Review before anything is published"
        lede="Four drafts, one verdict, one decision. An edit here can become a rule that changes every run after it."
      />

      <div className="layout">
        <div
          className="folio-stack"
          ref={stack}
          style={{ display: "grid", gap: "var(--sp-5)" }}
        >
          {txId === null ? (
            <Card>
              <EmptyState title="No run is waiting">
                Start a run on Intake. When it stops for you, this desk opens by itself
                and holds the four drafts it wrote.
              </EmptyState>
            </Card>
          ) : loading ? (
            <Card title="Reading the run" live>
              <Skeleton height="1.25rem" width="40%" />
              <Skeleton height="9rem" />
            </Card>
          ) : tx === null ? (
            <Card title="That run is not here">
              <ErrorCallout error={runError ?? "The service holds no run with that number."} />
            </Card>
          ) : draft === null ? (
            <Card title="This run wrote no drafts" note={STATUS[tx.status]}>
              {tx.error_message ? (
                <ErrorCallout error={tx.error_message} />
              ) : (
                <p className="quiet">
                  The run stopped before the drafts were written, so there is nothing to approve. Run it again from the run screen.
                </p>
              )}
            </Card>
          ) : (
            <>
              {tx.recommendation !== null && <Verdict verdict={tx.recommendation} />}

              <Card
                title="The document sheet"
                note="Markdown. It becomes a file in your data repository."
              >
                <TextArea
                  label="The sheet"
                  mono
                  rows={14}
                  readOnly={!open}
                  value={draft.doc_sheet_md}
                  onChange={(event) => review.set({ doc_sheet_md: event.target.value })}
                />
              </Card>

              <Card title="The portfolio card" note="What a person sees first.">
                <div className="folio-grid">
                  <Field
                    label="Title"
                    readOnly={!open}
                    value={draft.card_title}
                    onChange={(event) => review.set({ card_title: event.target.value })}
                  />
                  <Field
                    label="Tagline"
                    readOnly={!open}
                    value={draft.card_tagline}
                    onChange={(event) => review.set({ card_tagline: event.target.value })}
                  />
                </div>
                <div className="folio-grid">
                  <TextArea
                    label="Stack"
                    help="One name on each line."
                    rows={5}
                    readOnly={!open}
                    value={draft.card_stack}
                    onChange={(event) => review.set({ card_stack: event.target.value })}
                  />
                  <TextArea
                    label="Highlights"
                    help="One line for each one."
                    rows={5}
                    readOnly={!open}
                    value={draft.card_highlights}
                    onChange={(event) =>
                      review.set({ card_highlights: event.target.value })
                    }
                  />
                </div>
                <Field
                  label="Repository address"
                  mono
                  readOnly={!open}
                  value={draft.card_repo_url}
                  onChange={(event) => review.set({ card_repo_url: event.target.value })}
                />
              </Card>

              <Card title="The resume bullets" note="They go to your bullet bank.">
                <TextArea
                  label="Bullets"
                  help="One bullet on each line. An empty line goes out by itself."
                  rows={7}
                  readOnly={!open}
                  value={draft.resume_bullets}
                  onChange={(event) => review.set({ resume_bullets: event.target.value })}
                />
              </Card>

              <Card title="The social draft" note="Nothing is posted from here.">
                <TextArea
                  label="The post"
                  rows={6}
                  readOnly={!open}
                  value={draft.social_draft}
                  onChange={(event) => review.set({ social_draft: event.target.value })}
                />
              </Card>

              <Card title="Your decision" note={STATUS[tx.status]}>
                {review.result !== null && <Receipt result={review.result} />}

                {review.error !== null && (
                  <ErrorCallout error={review.error} style={{ marginTop: "var(--sp-3)" }} />
                )}

                {review.edited && (
                  <p className="quiet">
                    You changed the drafts. Approving sends your text, and the curator
                    reads the change to suggest a rule.
                  </p>
                )}

                {review.canDecide && (
                  <div className="row-controls">
                    <Button tone="primary" busy={review.busy} onClick={review.approve}>
                      {review.busy ? "Publishing to GitHub..." : "Approve and publish"}
                    </Button>
                    <Button tone="danger" busy={review.busy} onClick={review.reject}>
                      Reject
                    </Button>
                    {review.edited && (
                      <Button tone="quiet" onClick={review.undo}>
                        Undo my changes
                      </Button>
                    )}
                  </div>
                )}

                {review.canRetry && (
                  <>
                    <p className="quiet">
                      One commit succeeded and the other failed. Retrying will re-attempt writing both commits without altering existing work.
                    </p>
                    <div className="row-controls">
                      <Button tone="primary" busy={review.busy} onClick={review.approve}>
                        {review.busy ? "Writing commits to GitHub..." : "Try the commits again"}
                      </Button>
                    </div>
                  </>
                )}

                {!open && review.result === null && (
                  <p className="quiet">
                    This run is past the gate, so the drafts are here to read and no
                    decision is open. The four folios above are what it holds.
                  </p>
                )}
              </Card>

            </>
          )}
        </div>

        <aside className="rail">
          <h2 className="card-title">Your voice</h2>
          <p className="quiet">
            A switch is the state. A rule changes every run after it, and the rules
            are read new on each run, so a change here takes effect the next time
            and not on this one.
          </p>

          {rules.error !== null && (
            <ErrorCallout error={rules.error} style={{ margin: "var(--sp-3) 0" }} />
          )}

          {rules.loading ? (
            <Skeleton height="4rem" />
          ) : rules.rules.length === 0 ? (
            <p className="faint">
              No rule yet. Change a draft, approve it, and the curator suggests the first
              one. Or write one here.
            </p>
          ) : (
            <ul className="rule-list">
              {rules.rules.map((rule) => (
                <RuleRow
                  key={rule.rule_id}
                  rule={rule}
                  used={applied.has(rule.rule_id)}
                  busy={rules.busy === rule.rule_id}
                  onToggle={() => rules.toggle(rule)}
                  onRemove={() => rules.remove(rule)}
                />
              ))}
            </ul>
          )}

          <div className="rule-new">
            <TextArea
              label="Keep this as a rule"
              help="One sentence that says how you want the drafts written."
              rows={3}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <Button
              tone="plain"
              busy={rules.busy === "new"}
              disabled={text.trim() === ""}
              onClick={keep}
            >
              Add the rule
            </Button>
          </div>
        </aside>
      </div>
    </>
  );
}
