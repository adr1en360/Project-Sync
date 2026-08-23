import { useState } from "react";
import { BULLET_TAGS, type BulletTag, type RuleState } from "../api/types";
import { NEW_ROW, useBullets } from "../hooks/useBullets";
import { useCopy } from "../hooks/useCopy";
import { useHistory } from "../hooks/useHistory";
import { useRules } from "../hooks/useRules";
import { BULLET_TAG } from "../labels";
import { BulletRow } from "../library/BulletRow";
import { HistoryRow } from "../library/HistoryRow";
import { RuleRow } from "../library/RuleRow";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { Field } from "../ui/Field";
import { Segmented, type Segment } from "../ui/Segmented";
import { Skeleton } from "../ui/Skeleton";
import { TextArea } from "../ui/TextArea";
import { ScreenHead } from "./ScreenHead";

/**
 * The bullet bank and the history, in two views of one screen.
 *
 * The view is in the address, as `#/library/history`, so a person can send a link
 * to the history and a reload keeps the view. The two are one screen and not two
 * tabs, because both answer the same question: what has this product made for me.
 *
 * Both views read when the screen opens, and not when a view is first shown. The
 * cost is one request that a person may not use, and the gain is that the switch
 * between the views is instant and that a person who goes back and comes again
 * makes no second request.
 *
 * The filters of the bank are in the side column, where the layout comment in
 * `shell.css` says they belong. The filter is in the client: `store.list_bullets`
 * reads every bullet of the person before it filters, so a filter on the service
 * would cost the same and it would add one request for each press of a chip.
 */

type Props = {
  /** The second part of the address, which names the view. */
  segment: string | null;
  onSegment: (id: string) => void;
  /** Open one of the three steps with the id of a run. */
  onGo: (where: "run" | "review", txId: string, said?: string) => void;
};

/** How many rows of bones to show while a list loads. */
const BONES = [0, 1, 2];

/**
 * The three groups of the rules, in the order a person needs them.
 *
 * A rule that the curator found is first, because it is the only one that asks
 * for a decision. The rules that are on come next, because they are what the
 * next run will do. The rules that are off are last, because they do nothing.
 *
 * There is no filter control over these groups. A filter with three states and
 * three chips was on the screen before, and it hid two thirds of a list that is
 * short enough to read whole.
 */
const GROUPS: readonly { state: RuleState; head: string; why: string | null }[] = [
  {
    state: "PROPOSED",
    head: "Suggested for you",
    why: "The curator wrote these from the edits you made on the review desk. Nothing happens until you turn one on.",
  },
  { state: "ACTIVE", head: "On", why: null },
  { state: "INACTIVE", head: "Off", why: null },
];

export function Library({ segment, onSegment, onGo }: Props) {
  const view =
    segment === "history" ? "history" : segment === "voice" ? "voice" : "bullets";
  const bank = useBullets();
  const ledger = useHistory();
  const rules = useRules();
  const copier = useCopy();

  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftProject, setDraftProject] = useState("");
  const [draftTags, setDraftTags] = useState<readonly BulletTag[]>([]);

  const [ruling, setRuling] = useState(false);
  const [ruleText, setRuleText] = useState("");

  const ready = draft.trim() !== "" && draftProject.trim() !== "";
  const filtered = bank.project !== null || bank.chosen.length > 0;

  const segments: readonly Segment[] = [
    {
      id: "bullets",
      label: "Bullets",
      note: bank.rows === null ? undefined : bank.rows.length,
    },
    {
      id: "history",
      label: "History",
      note: ledger.rows === null ? undefined : ledger.rows.length,
    },
    {
      id: "voice",
      label: "Voice",
      note: rules.loading ? undefined : rules.rules.length,
    },
  ];

  const add = async () => {
    if (await bank.add(draft.trim(), draftProject.trim(), draftTags)) {
      setDraft("");
      setDraftTags([]);
      setWriting(false);
    }
  };

  const keepRule = async () => {
    if (await rules.add(ruleText.trim())) {
      setRuleText("");
      setRuling(false);
    }
  };

  /**
   * Run Phase 1 again and follow the run.
   *
   * A resume is a new run of the whole of Phase 1 under the same id, so the run
   * screen is where it is watched. The move is said out loud, because a person
   * asked for a run and not for a change of screen.
   */
  const resume = async (txId: string) => {
    const started = await ledger.resume(txId);
    if (started !== null) {
      onGo("run", started, "The run started again. The run screen is open.");
    }
  };

  return (
    <>
      <ScreenHead
        title="Library"
        lede={
          view === "voice"
            ? "The rules that change how every run after them is written. A rule can come from an edit you made on the review desk."
            : view === "history"
              ? "Every run you have made, in every state, newest first."
              : "Every resume bullet you kept, ready to copy into an application."
        }
      />

      <div className="screen-tools tools-wrap">
        <Segmented
          ariaLabel="The view of the library"
          items={segments}
          current={view}
          onPick={onSegment}
        />

        <div className="tools-right">
          {view === "bullets" ? (
            <>
              <span className="quiet tools-note">
                {bank.rows === null
                  ? "Reading the bank"
                  : filtered
                    ? `${String(bank.shown.length)} of ${String(bank.rows.length)}`
                    : `${String(bank.rows.length)} in the bank`}
              </span>
              <Button tone="quiet" onClick={bank.reload}>
                Read it again
              </Button>
            </>
          ) : view === "history" ? (
            <>
              <span className="quiet tools-note">
                {ledger.rows === null
                  ? "Reading the history"
                  : `${String(ledger.rows.length)} runs`}
              </span>
              <Button tone="quiet" onClick={ledger.reload}>
                Read it again
              </Button>
            </>
          ) : (
            <span className="quiet tools-note">
              {rules.loading
                ? "Reading the rules"
                : `${String(rules.rules.filter((rule) => rule.state === "ACTIVE").length)} on, ${String(rules.rules.length)} in all`}
            </span>
          )}
        </div>
      </div>

      <div className="layout">
        {view === "bullets" ? (
          <Card title="The bank" note="One line for each thing you shipped.">
            {bank.error !== null && (
              <p className="field-error" role="alert">
                {bank.error}
              </p>
            )}

            {/* The clipboard is not given to a page on every origin, and a person
                can refuse it. A control that says "Copied" when nothing was
                copied is worse than a control that says why. */}
            {copier.failed !== null && (
              <p className="field-error" role="alert">
                {copier.failed}
              </p>
            )}

            {bank.loading && (
              <ol className="rule-list">
                {BONES.map((index) => (
                  <li key={index} className="rule-row">
                    <Skeleton width="100%" height="1.1rem" />
                    <Skeleton width="60%" height="1.1rem" />
                    <Skeleton width="9rem" height="0.9rem" />
                  </li>
                ))}
              </ol>
            )}

            {bank.rows !== null && bank.rows.length === 0 && (
              <EmptyState title="The bank holds nothing yet">
                A bullet arrives here the first time you approve a run. You can
                also write one by hand, and a run that committed can put its
                bullets in from the history.
              </EmptyState>
            )}

            {bank.rows !== null && bank.rows.length > 0 && bank.shown.length === 0 && (
              <EmptyState
                title="No bullet matches the filter"
                action={
                  <Button tone="quiet" onClick={bank.clear}>
                    Clear the filter
                  </Button>
                }
              >
                The bank holds {bank.rows.length} bullets. None of them is in the
                project and the tags you chose.
              </EmptyState>
            )}

            {bank.shown.length > 0 && (
              <ol className="rule-list">
                {bank.shown.map((row) => (
                  <BulletRow
                    key={row.bullet_id}
                    row={row}
                    busy={bank.busy === row.bullet_id}
                    copied={copier.copied === row.bullet_id}
                    onCopy={() => {
                      copier.copy(row.bullet_id, row.text);
                    }}
                    onSave={(change) => bank.save(row.bullet_id, change)}
                    onRemove={() => bank.remove(row.bullet_id)}
                  />
                ))}
              </ol>
            )}

            <div className="rule-new">
              <Button
                tone="quiet"
                aria-expanded={writing}
                onClick={() => {
                  setWriting(!writing);
                }}
              >
                {writing ? "Close" : "Write a bullet"}
              </Button>

              <div
                className="reveal"
                data-open={writing ? "true" : "false"}
                aria-hidden={writing ? undefined : true}
              >
                <div className="reveal-body">
                  <div className="row-editor">
                    <TextArea
                      label="The bullet"
                      rows={3}
                      value={draft}
                      placeholder="Cut the cold start of the API from 900ms to 180ms."
                      onChange={(event) => {
                        setDraft(event.target.value);
                      }}
                      help="One line. What you did, and what it changed."
                    />

                    <Field
                      label="Project"
                      value={draftProject}
                      placeholder="projectsync"
                      onChange={(event) => {
                        setDraftProject(event.target.value);
                      }}
                      help="The name that groups this bullet with the others of the same work."
                    />

                    <div>
                      <span className="field-label">Tags</span>
                      <div className="chip-row" style={{ marginTop: "var(--sp-2)" }}>
                        {BULLET_TAGS.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            className="chip"
                            aria-pressed={draftTags.includes(tag)}
                            onClick={() => {
                              setDraftTags((was) =>
                                was.includes(tag)
                                  ? was.filter((one) => one !== tag)
                                  : [...was, tag],
                              );
                            }}
                          >
                            {BULLET_TAG[tag]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <p className="row-controls">
                      <Button
                        tone="primary"
                        busy={bank.busy === NEW_ROW}
                        disabled={bank.busy === NEW_ROW || !ready}
                        onClick={() => {
                          void add();
                        }}
                      >
                        {bank.busy === NEW_ROW ? "Writing" : "Put it in the bank"}
                      </Button>
                      <Button
                        tone="quiet"
                        onClick={() => {
                          setWriting(false);
                        }}
                      >
                        Cancel
                      </Button>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ) : view === "history" ? (
          <Card title="Your runs" note="Newest first. Every state, and not only the ones that worked.">
            {ledger.error !== null && (
              <p className="field-error" role="alert">
                {ledger.error}
              </p>
            )}

            {ledger.said !== null && (
              <p className="quiet" role="status">
                {ledger.said}
              </p>
            )}

            {ledger.loading && (
              <ol className="rule-list">
                {BONES.map((index) => (
                  <li key={index} className="rule-row">
                    <Skeleton width="14rem" height="1.1rem" />
                    <Skeleton width="60%" height="0.9rem" />
                  </li>
                ))}
              </ol>
            )}

            {ledger.rows !== null && ledger.rows.length === 0 && (
              <EmptyState title="You have made no run yet">
                Give a repository on the intake step. Every run you make lands
                here, and it stays here whether it worked or not.
              </EmptyState>
            )}

            {ledger.rows !== null && ledger.rows.length > 0 && (
              <ol className="rule-list">
                {ledger.rows.map((row) => (
                  <HistoryRow
                    key={row.tx_id}
                    row={row}
                    steps={ledger.steps[row.tx_id]}
                    busy={ledger.busy === row.tx_id}
                    onSteps={() => {
                      ledger.askSteps(row.tx_id);
                    }}
                    onOpen={() => {
                      onGo("run", row.tx_id);
                    }}
                    onReview={() => {
                      onGo("review", row.tx_id);
                    }}
                    onResume={() => {
                      void resume(row.tx_id);
                    }}
                    onFill={() => {
                      void ledger.fill(row.tx_id);
                    }}
                  />
                ))}
              </ol>
            )}
          </Card>
        ) : (
          <Card title="Your voice" note="A switch is the state. Press it to change it.">
            {rules.error !== null && (
              <p className="field-error" role="alert">
                {rules.error}
              </p>
            )}

            {rules.loading && (
              <ol className="rule-list">
                {BONES.map((index) => (
                  <li key={index} className="rule-row">
                    <Skeleton width="100%" height="1.1rem" />
                    <Skeleton width="40%" height="0.9rem" />
                  </li>
                ))}
              </ol>
            )}

            {!rules.loading && rules.rules.length === 0 && (
              <EmptyState title="You have no rules yet">
                Change a draft on the review desk and approve it. The curator
                reads what you changed and suggests the rule behind it. You can
                also write one here.
              </EmptyState>
            )}

            {GROUPS.map((group) => {
              const held = rules.rules.filter((rule) => rule.state === group.state);
              if (held.length === 0) {
                return null;
              }
              return (
                <section key={group.state} className="list-group">
                  <h3 className="list-head">
                    {group.head}
                    <span className="list-count">{held.length}</span>
                  </h3>
                  {group.why !== null && <p className="quiet list-why">{group.why}</p>}
                  <ul className="rule-list">
                    {held.map((rule) => (
                      <RuleRow
                        key={rule.rule_id}
                        rule={rule}
                        busy={rules.busy === rule.rule_id}
                        onToggle={() => {
                          rules.toggle(rule);
                        }}
                        onRemove={() => {
                          rules.remove(rule);
                        }}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}

            <div className="rule-new">
              <Button
                tone="quiet"
                aria-expanded={ruling}
                onClick={() => {
                  setRuling(!ruling);
                }}
              >
                {ruling ? "Close" : "Write a rule"}
              </Button>

              <div
                className="reveal"
                data-open={ruling ? "true" : "false"}
                aria-hidden={ruling ? undefined : true}
              >
                <div className="reveal-body">
                  <div className="row-editor">
                    <TextArea
                      label="The rule"
                      rows={3}
                      value={ruleText}
                      placeholder="Never call a project innovative. Say what it does."
                      onChange={(event) => {
                        setRuleText(event.target.value);
                      }}
                      help="One sentence that says how you want the drafts written. It goes into every run after this."
                    />

                    <p className="row-controls">
                      <Button
                        tone="primary"
                        busy={rules.busy === "new"}
                        disabled={rules.busy === "new" || ruleText.trim() === ""}
                        onClick={() => {
                          void keepRule();
                        }}
                      >
                        {rules.busy === "new" ? "Writing" : "Turn it on"}
                      </Button>
                      <Button
                        tone="quiet"
                        onClick={() => {
                          setRuling(false);
                        }}
                      >
                        Cancel
                      </Button>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        <aside className="rail">
          {view === "bullets" ? (
            <>
              <h2 className="card-title" style={{ fontSize: "var(--step-1)" }}>
                Filter the bank
              </h2>

              <div className="field" style={{ marginTop: "var(--sp-4)" }}>
                <label className="field-label" htmlFor="bank-project">
                  Project
                </label>
                <select
                  id="bank-project"
                  className="field-input"
                  value={bank.project ?? ""}
                  onChange={(event) => {
                    bank.setProject(event.target.value === "" ? null : event.target.value);
                  }}
                >
                  <option value="">Every project</option>
                  {bank.projects.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginTop: "var(--sp-5)" }}>
                <span className="field-label">Tags</span>
                {/* Only the tags that a bullet carries. The service holds fifteen,
                    and a row of fifteen chips where twelve find nothing is a
                    control that lies about what is in the bank. */}
                {bank.tags.length === 0 ? (
                  <p className="quiet" style={{ margin: "var(--sp-2) 0 0", fontSize: "var(--step--1)" }}>
                    No bullet in the bank carries a tag yet.
                  </p>
                ) : (
                  <div className="chip-row" style={{ marginTop: "var(--sp-2)" }}>
                    {bank.tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="chip"
                        aria-pressed={bank.chosen.includes(tag)}
                        onClick={() => {
                          bank.toggleTag(tag);
                        }}
                      >
                        {BULLET_TAG[tag]}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {filtered && (
                <p className="row-controls">
                  <Button tone="quiet" onClick={bank.clear}>
                    Clear the filter
                  </Button>
                </p>
              )}

              <p className="quiet" style={{ margin: "var(--sp-5) 0 0", fontSize: "var(--step--1)" }}>
                A bullet with one of the chosen tags is kept. That is the rule the
                service uses, so the two answers are the same.
              </p>
            </>
          ) : view === "voice" ? (
            <>
              <h2 className="card-title" style={{ fontSize: "var(--step-1)" }}>
                How a rule works
              </h2>
              <dl className="pair-list" style={{ marginTop: "var(--sp-4)" }}>
                <dt>When it takes effect</dt>
                <dd>
                  The rules are read new at the start of every run, so a change
                  here changes the next run and not one that is already going.
                </dd>
                <dt>Suggested</dt>
                <dd>
                  The curator wrote it from an edit of yours. It does nothing
                  until you turn it on.
                </dd>
                <dt>On</dt>
                <dd>Every run after now is written with this rule in it.</dd>
                <dt>Off</dt>
                <dd>
                  It stays here and does nothing. Turn it on again at any time.
                </dd>
              </dl>
              <p className="quiet" style={{ margin: "var(--sp-5) 0 0", fontSize: "var(--step--1)" }}>
                The review desk shows this same list beside the drafts, so you can
                turn a rule on without leaving the decision.
              </p>
            </>
          ) : (
            <>
              <h2 className="card-title" style={{ fontSize: "var(--step-1)" }}>
                What a row can do
              </h2>
              <dl className="pair-list" style={{ marginTop: "var(--sp-4)" }}>
                <dt>Review it</dt>
                <dd>The run finished and it waits for your decision.</dd>
                <dt>Run it again</dt>
                <dd>
                  A run that stopped or failed runs the whole of Phase 1 again,
                  under the same id. There is no start from the middle.
                </dd>
                <dt>Add its bullets</dt>
                <dd>
                  An approval fills the bank by itself when both commits land. A
                  run that committed one of the two needs this.
                </dd>
                <dt>Steps and times</dt>
                <dd>
                  The seven nodes of the graph, with the time each one took. The
                  log of a run is read the first time you open its row.
                </dd>
              </dl>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
