import { useState } from "react";
import { BULLET_TAGS, type BulletTag, type RuleState } from "../api/types";
import { NEW_ROW, useBullets } from "../hooks/useBullets";
import { useCopy } from "../hooks/useCopy";
import { useHistory } from "../hooks/useHistory";
import { useRules } from "../hooks/useRules";
import { BULLET_TAG } from "../labels";
import { BulletGroup } from "../library/BulletGroup";
import { byProject } from "../library/group";
import { HistoryRow } from "../library/HistoryRow";
import { RuleRow } from "../library/RuleRow";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { ErrorCallout } from "../ui/ErrorCallout";
import { Field } from "../ui/Field";
import { Segmented, type Segment } from "../ui/Segmented";
import { Skeleton } from "../ui/Skeleton";
import { TextArea } from "../ui/TextArea";
import { RefreshIcon } from "../ui/icons";
import { ScreenHead } from "./ScreenHead";

/**
 * The Library screen provides three unified views:
 * 1. Bullets: Bank of career achievements grouped by repository, ready for CV/resume export.
 * 2. History: Full transaction ledger of repository sync runs and node execution timings.
 * 3. Voice: Custom tone and style rules that steer future AI generation.
 */

type Props = {
  /** The segment view selector (bullets, history, voice). */
  segment: string | null;
  onSegment: (id: string) => void;
  /** Navigate to a specific step with transaction context. */
  onGo: (where: "run" | "review", txId: string, said?: string) => void;
};

/** Skeleton count placeholder for loading lists. */
const BONES = [0, 1, 2];

/**
 * Three categorized states of style rules.
 */
const GROUPS: readonly { state: RuleState; head: string; why: string | null }[] = [
  {
    state: "PROPOSED",
    head: "Suggested for you",
    why: "Curated from your edits on the review desk. Turn one on to apply it to future runs.",
  },
  { state: "ACTIVE", head: "Active", why: null },
  { state: "INACTIVE", head: "Inactive", why: null },
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
      setDraftProject("");
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

  const resume = async (txId: string) => {
    const started = await ledger.resume(txId);
    if (started !== null) {
      onGo("run", started, "Sync restarted. Monitoring live execution.");
    }
  };

  return (
    <>
      <ScreenHead
        title="Library"
        lede={
          view === "voice"
            ? "Manage the tone and style rules that shape your generated career assets."
            : view === "history"
              ? "Review past repository sync runs, inspect per-node timings, and resume incomplete tasks."
              : "Your verified resume bullets, grouped by repository and formatted for job applications."
        }
      />

      <div className="screen-tools tools-wrap">
        <Segmented
          ariaLabel="Library section selector"
          items={segments}
          current={view}
          onPick={onSegment}
        />

        <div className="tools-right">
          {view === "bullets" ? (
            <>
              <span className="quiet tools-note">
                {bank.rows === null
                  ? "Loading bullets..."
                  : filtered
                    ? `${String(bank.shown.length)} of ${String(bank.rows.length)} shown`
                    : `${String(bank.rows.length)} total`}
              </span>
              <button
                type="button"
                className="icon-btn"
                onClick={bank.reload}
                aria-label="Refresh bullet bank"
                title="Refresh bullets"
              >
                <RefreshIcon />
              </button>
            </>
          ) : view === "history" ? (
            <>
              <span className="quiet tools-note">
                {ledger.rows === null
                  ? "Loading history..."
                  : `${String(ledger.rows.length)} runs`}
              </span>
              <button
                type="button"
                className="icon-btn"
                onClick={ledger.reload}
                aria-label="Refresh sync history"
                title="Refresh history"
              >
                <RefreshIcon />
              </button>
            </>
          ) : (
            <span className="quiet tools-note">
              {rules.loading
                ? "Loading rules..."
                : `${String(rules.rules.filter((rule) => rule.state === "ACTIVE").length)} active, ${String(rules.rules.length)} total`}
            </span>
          )}
        </div>
      </div>

      <div className="layout">
        {view === "bullets" ? (
          <Card title="Resume Bullets" note="Copy individual bullets or an entire project's achievements at once.">
            {bank.error !== null && (
              <ErrorCallout error={bank.error} style={{ marginBottom: "var(--sp-3)" }} />
            )}

            {copier.failed !== null && (
              <ErrorCallout error={copier.failed} style={{ marginBottom: "var(--sp-3)" }} />
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
              <EmptyState title="No bullets saved yet">
                Approve a repository sync on the Review desk to save its bullet points, or add a custom bullet below.
              </EmptyState>
            )}

            {bank.rows !== null && bank.rows.length > 0 && bank.shown.length === 0 && (
              <EmptyState
                title="No matching bullets found"
                action={
                  <Button tone="quiet" onClick={bank.clear}>
                    Reset filters
                  </Button>
                }
              >
                None of the {bank.rows.length} saved bullets match your selected project or tags.
              </EmptyState>
            )}

            {bank.shown.length > 0 && (
              <div className="bank-groups stagger">
                {byProject(bank.shown).map((group, index) => (
                  <BulletGroup
                    key={group.project}
                    group={group}
                    index={index}
                    copied={copier.copied}
                    busy={bank.busy}
                    onCopy={copier.copy}
                    onSave={bank.save}
                    onRemove={bank.remove}
                  />
                ))}
              </div>
            )}

            <div className="rule-new">
              <Button
                tone="quiet"
                aria-expanded={writing}
                onClick={() => {
                  setWriting(!writing);
                }}
              >
                {writing ? "Close editor" : "Add custom bullet"}
              </Button>

              <div
                className="reveal"
                data-open={writing ? "true" : "false"}
                aria-hidden={writing ? undefined : true}
              >
                <div className="reveal-body">
                  <div className="row-editor">
                    <TextArea
                      label="Bullet text"
                      rows={3}
                      value={draft}
                      placeholder="Reduced API cold-start latency from 900ms to 180ms by refactoring initialization logic."
                      onChange={(event) => {
                        setDraft(event.target.value);
                      }}
                      help="Be specific and include quantifiable outcomes where possible."
                    />

                    <Field
                      label="Project / Repository"
                      value={draftProject}
                      placeholder="project-sync"
                      onChange={(event) => {
                        setDraftProject(event.target.value);
                      }}
                      help="Repository name to group this bullet with related work."
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
                        {bank.busy === NEW_ROW ? "Saving..." : "Save to bank"}
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
          <Card title="Sync History" note="All past repository runs, latest first.">
            {ledger.error !== null && (
              <ErrorCallout error={ledger.error} style={{ marginBottom: "var(--sp-3)" }} />
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
              <EmptyState title="No sync runs yet">
                Submit a repository on the Intake screen to start your first sync run.
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
          <Card title="Voice & Tone Rules" note="Toggle rules on or off to guide how your assets are written.">
            {rules.error !== null && (
              <ErrorCallout error={rules.error} style={{ marginBottom: "var(--sp-3)" }} />
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
              <EmptyState title="No rules defined yet">
                Edit a draft on the Review desk to generate a suggested style rule, or create one manually below.
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
                {ruling ? "Close editor" : "Add style rule"}
              </Button>

              <div
                className="reveal"
                data-open={ruling ? "true" : "false"}
                aria-hidden={ruling ? undefined : true}
              >
                <div className="reveal-body">
                  <div className="row-editor">
                    <TextArea
                      label="Style rule"
                      rows={3}
                      value={ruleText}
                      placeholder="Use concise action verbs and avoid marketing jargon."
                      onChange={(event) => {
                        setRuleText(event.target.value);
                      }}
                      help="A clear guideline to direct the tone of future sync runs."
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
                        {rules.busy === "new" ? "Saving..." : "Add active rule"}
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
                Filter Bullets
              </h2>

              <div className="field" style={{ marginTop: "var(--sp-4)" }}>
                <label className="field-label" htmlFor="bank-project">
                  Repository
                </label>
                <select
                  id="bank-project"
                  className="field-input"
                  value={bank.project ?? ""}
                  onChange={(event) => {
                    bank.setProject(event.target.value === "" ? null : event.target.value);
                  }}
                >
                  <option value="">All repositories</option>
                  {bank.projects.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginTop: "var(--sp-5)" }}>
                <span className="field-label">Tags</span>
                {bank.tags.length === 0 ? (
                  <p className="quiet" style={{ margin: "var(--sp-2) 0 0", fontSize: "var(--step--1)" }}>
                    No tags currently assigned.
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
                    Reset filter
                  </Button>
                </p>
              )}

              <p className="quiet" style={{ margin: "var(--sp-5) 0 0", fontSize: "var(--step--1)" }}>
                Selecting tags shows bullets matching any chosen category.
              </p>
            </>
          ) : view === "voice" ? (
            <>
              <h2 className="card-title" style={{ fontSize: "var(--step-1)" }}>
                How Style Rules Work
              </h2>
              <dl className="pair-list" style={{ marginTop: "var(--sp-4)" }}>
                <dt>Timing</dt>
                <dd>
                  Rules are loaded at the start of each sync run and steer subsequent generations.
                </dd>
                <dt>Suggested</dt>
                <dd>
                  Extracted automatically from edits you make on the review desk. Activate when ready.
                </dd>
                <dt>Active</dt>
                <dd>Applied to all upcoming sync runs.</dd>
                <dt>Inactive</dt>
                <dd>Saved for reference without affecting generation.</dd>
              </dl>
              <p className="quiet" style={{ margin: "var(--sp-5) 0 0", fontSize: "var(--step--1)" }}>
                You can also toggle rules directly from the Review desk sidebar.
              </p>
            </>
          ) : (
            <>
              <h2 className="card-title" style={{ fontSize: "var(--step-1)" }}>
                Sync Run Actions
              </h2>
              <dl className="pair-list" style={{ marginTop: "var(--sp-4)" }}>
                <dt>Review</dt>
                <dd>Inspect and approve generated drafts for completed runs.</dd>
                <dt>Resume</dt>
                <dd>Restart an incomplete or cancelled run using the same transaction ID.</dd>
                <dt>Populate Bullets</dt>
                <dd>
                  Directly populate your bullet bank from an approved transaction.
                </dd>
                <dt>Execution Details</dt>
                <dd>
                  Inspect individual node durations and real-time execution logs.
                </dd>
              </dl>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
