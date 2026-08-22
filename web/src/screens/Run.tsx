import { Card } from "../ui/Card";
import { Mark } from "../ui/Mark";
import { Tag } from "../ui/Tag";
import { ScreenHead } from "./ScreenHead";

/**
 * Step 2. The graph at work.
 *
 * The seven rows are the seven nodes of the Phase 1 graph. Stage F3 shows the
 * rows and the marks. Stage F4 drives them from
 * `GET /transactions/{id}/events`, and it brings the cancel control and the
 * resume control with it.
 *
 * The name of the node under each row appears only when the internals switch
 * is on, and stage F4 adds that line with `labels.ts`.
 */

const STEPS: readonly { label: string; state: "pass" | "work" | "wait" }[] = [
  { label: "Read the repository", state: "pass" },
  { label: "Understand the project", state: "pass" },
  { label: "Attach your voice rules", state: "work" },
  { label: "Write the four drafts", state: "wait" },
  { label: "Choose what to check", state: "wait" },
  { label: "Check it is safe to show", state: "wait" },
  { label: "Save it and stop for you", state: "wait" },
];

const WORD: Record<"pass" | "work" | "wait", string> = {
  pass: "Done",
  work: "At work",
  wait: "Waiting",
};

export function Run() {
  return (
    <>
      <ScreenHead
        title="The run"
        lede="Seven steps, in order. The run stops at the end and waits for you. Nothing leaves the service until you approve it."
      />

      <div className="layout">
        <Card title="The steps" note="An example, until stage F4">
          <ol
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: "var(--sp-1)",
            }}
          >
            {STEPS.map((step) => (
              <li
                key={step.label}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  alignItems: "center",
                  gap: "var(--sp-3)",
                  padding: "var(--sp-3) 0",
                  borderTop: "var(--rule) solid var(--paper-edge)",
                }}
              >
                <Mark state={step.state} />
                <span>{step.label}</span>
                <span className="faint" style={{ fontSize: "var(--step--1)" }}>
                  {WORD[step.state]}
                </span>
              </li>
            ))}
          </ol>
        </Card>

        <aside className="rail">
          <h2 className="card-title" style={{ fontSize: "var(--step-1)" }}>
            This run
          </h2>
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "var(--sp-2) var(--sp-4)",
              margin: "var(--sp-4) 0 0",
              fontSize: "var(--step--1)",
            }}
          >
            <dt className="quiet">State</dt>
            <dd style={{ margin: 0 }}>
              <Tag tone="hold">Waiting for you</Tag>
            </dd>
            <dt className="quiet">Transaction</dt>
            <dd className="mono" style={{ margin: 0 }}>
              not started
            </dd>
          </dl>
        </aside>
      </div>
    </>
  );
}