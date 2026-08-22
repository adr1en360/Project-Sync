import { useShowMore } from "../hooks/useShowMore";
import { Card } from "../ui/Card";
import { Mark } from "../ui/Mark";
import { Switch } from "../ui/Switch";
import { Tag } from "../ui/Tag";
import { ScreenHead } from "./ScreenHead";

/**
 * Step 2. The graph at work.
 *
 * The seven rows are the seven nodes of the Phase 1 graph. Stage F3 shows the
 * rows, the marks and the name of each node. Stage F4 drives them from
 * `GET /transactions/{id}/events`, and it brings the cancel control and the
 * resume control with it.
 *
 * The screen holds its own "Show more" control. Off, each row is one short
 * sentence. On, each row also shows the name of the node that does the work,
 * and the rail names the graph. Stage F4 adds the time of each node to the
 * same reveal.
 */

type State = "pass" | "work" | "wait";

const STEPS: readonly { label: string; node: string; state: State }[] = [
  { label: "Read the repository", node: "scan_github_repository", state: "pass" },
  { label: "Understand the project", node: "extraction_agent", state: "pass" },
  { label: "Attach your voice rules", node: "attach_style_rules", state: "work" },
  { label: "Write the four drafts", node: "asset_generator_agent", state: "wait" },
  { label: "Choose what to check", node: "select_evaluator_input", state: "wait" },
  { label: "Check it is safe to show", node: "path_evaluator_agent", state: "wait" },
  { label: "Save it and stop for you", node: "persist_transaction", state: "wait" },
];

const WORD: Record<State, string> = {
  pass: "Done",
  work: "At work",
  wait: "Waiting",
};

export function Run() {
  const { more, toggleMore } = useShowMore();
  const open = more ? "true" : "false";
  const shut = more ? undefined : true;

  return (
    <>
      <ScreenHead
        title="The run"
        lede="Seven steps, in order. The run stops at the end and waits for you. Nothing leaves the service until you approve it."
      />

      {/* The control of this screen. It sits here and not in the masthead,
          because it changes this screen and no other. */}
      <div className="screen-tools">
        <Switch
          pressed={more}
          onToggle={toggleMore}
          title="Show the name of each node of the graph and the time it took"
        >
          Show more
        </Switch>
      </div>

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
                key={step.node}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  alignItems: "start",
                  gap: "var(--sp-3)",
                  padding: "var(--sp-3) 0",
                  borderTop: "var(--rule) solid var(--paper-edge)",
                }}
              >
                <Mark state={step.state} />
                <div style={{ minWidth: 0 }}>
                  <span>{step.label}</span>
                  {/* The name of the node. The reveal keeps it out of the page
                      when the control is off, so the row is one sentence. */}
                  <div className="reveal" data-open={open} aria-hidden={shut}>
                    <div className="reveal-body">
                      <span
                        className="mono faint"
                        style={{ display: "block", fontSize: "var(--step--1)" }}
                      >
                        {step.node}
                      </span>
                    </div>
                  </div>
                </div>
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

          <div className="reveal" data-open={open} aria-hidden={shut}>
            <div className="reveal-body">
              <dl
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: "var(--sp-2) var(--sp-4)",
                  margin: "var(--sp-4) 0 0",
                  fontSize: "var(--step--1)",
                }}
              >
                <dt className="quiet">Graph</dt>
                <dd className="mono faint" style={{ margin: 0 }}>
                  projectsync_phase1
                </dd>
                <dt className="quiet">Nodes</dt>
                <dd className="mono faint" style={{ margin: 0 }}>
                  {STEPS.length}
                </dd>
              </dl>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}