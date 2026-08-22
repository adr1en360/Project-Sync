import type { CSSProperties } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Field } from "../ui/Field";
import { Kbd } from "../ui/Kbd";
import { ScreenHead } from "./ScreenHead";

/**
 * Step 1. The repository.
 *
 * Stage F3 gives the shape of the screen and the controls. Stage F4 joins the
 * form to `POST /sync` and moves the person to the run screen.
 */

export function Intake() {
  return (
    <>
      <ScreenHead
        title="Start from a finished repository"
        lede="Give the owner and the name of a repository that is ready to show. ProjectSync reads it, writes four drafts, and stops for you to approve them."
      />

      <div className="bento stagger">
        <Card
          title="The repository"
          className="wide"
          style={{ "--index": 0 } as CSSProperties}
        >
          <div style={{ display: "grid", gap: "var(--sp-5)" }}>
            <Field
              label="Owner and name"
              placeholder="owner/repository"
              mono
              autoComplete="off"
              spellCheck={false}
              help="A public repository, or a private one that your token can read."
            />
            <div style={{ display: "flex", gap: "var(--sp-3)", alignItems: "center" }}>
              <Button tone="primary" disabled>
                Read the repository
              </Button>
              <span className="faint" style={{ fontSize: "var(--step--1)" }}>
                Stage F4 joins this control to the service.
              </span>
            </div>
          </div>
        </Card>

        <Card title="What happens next" style={{ "--index": 1 } as CSSProperties}>
          <ol
            className="quiet"
            style={{
              margin: 0,
              paddingLeft: "1.25rem",
              display: "grid",
              gap: "var(--sp-2)",
            }}
          >
            <li>ProjectSync reads the repository and the code in it.</li>
            <li>It writes a resume section, a portfolio card and two posts.</li>
            <li>It checks that the drafts are safe to show.</li>
            <li>It stops. Nothing is published until you approve it.</li>
          </ol>
        </Card>

        <Card title="Keyboard" style={{ "--index": 2 } as CSSProperties}>
          <p className="quiet" style={{ margin: 0 }}>
            Press <Kbd>Enter</Kbd> in the field to start. Press <Kbd>Esc</Kbd> to
            clear it.
          </p>
        </Card>
      </div>
    </>
  );
}