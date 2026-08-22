import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { ScreenHead } from "./ScreenHead";

/**
 * Step 3. The gate.
 *
 * The four drafts, the verdict and the approval. Stage F5 builds this screen
 * and the rail of voice rules beside it.
 */

export function Review() {
  return (
    <>
      <ScreenHead
        title="Review before anything is published"
        lede="Four drafts, one verdict, one decision. An edit here can become a rule that changes every run after it."
      />

      <div className="layout">
        <div style={{ display: "grid", gap: "var(--sp-5)" }}>
          <EmptyState title="No run is waiting">
            Start a run on Intake. When it stops, the four drafts arrive here
            with the verdict of the safety check.
          </EmptyState>
        </div>

        <aside className="rail">
          <h2 className="card-title" style={{ fontSize: "var(--step-1)" }}>
            Your voice
          </h2>
          <p className="quiet" style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--step--1)" }}>
            The rules that are on for this run appear here, with a switch for
            each one. Stage F5 brings them.
          </p>
        </aside>
      </div>

      <Card title="Why there is a gate" style={{ marginTop: "var(--sp-8)" }}>
        <p className="quiet" style={{ margin: 0 }}>
          A model can write a claim that a repository does not support. The gate
          is where a person reads the claim before an employer does.
        </p>
      </Card>
    </>
  );
}