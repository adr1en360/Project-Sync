import { useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import { triggerSync } from "../api/client";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Field } from "../ui/Field";
import { Kbd } from "../ui/Kbd";
import { ScreenHead } from "./ScreenHead";

/**
 * Step 1: Repository Intake.
 *
 * Initiates a repository sync via `POST /api/v1/trigger-sync` and immediately
 * navigates to the Run screen to monitor real-time execution.
 */

type Props = {
  /** Callback with the new transaction ID once the server accepts the intake request. */
  onStarted: (txId: string) => void;
};

export function Intake({ onStarted }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const repo = value.trim();
    if (repo === "") {
      setError("Please enter a repository owner and name (e.g. facebook/react).");
      return;
    }

    setBusy(true);
    setError(null);
    triggerSync(repo).then(
      (started) => {
        setBusy(false);
        onStarted(started.transaction_id);
      },
      (reason: unknown) => {
        setBusy(false);
        setError(reason instanceof Error ? reason.message : String(reason));
      },
    );
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      setValue("");
      setError(null);
    }
  }

  return (
    <>
      <ScreenHead
        title="Sync a GitHub Repository"
        lede="Enter a repository to extract technical achievements, generate four career assets, and review them before publishing."
      />

      <div className="bento stagger">
        <Card
          title="Repository"
          className="wide"
          style={{ "--index": 0 } as CSSProperties}
        >
          <form onSubmit={submit} style={{ display: "grid", gap: "var(--sp-5)" }}>
            <Field
              label="Owner and name"
              placeholder="owner/repository"
              mono
              autoComplete="off"
              spellCheck={false}
              help="A public repository, or a private one accessible with your GITHUB_TOKEN."
              error={error ?? undefined}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={keyDown}
            />
            <div
              style={{
                display: "flex",
                gap: "var(--sp-4)",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <Button type="submit" tone="primary" busy={busy}>
                {busy ? "Syncing repository..." : "Sync Repository"}
              </Button>
              <span className="faint" style={{ fontSize: "var(--step--1)" }}>
                Pauses for human review before any commits are published.
              </span>
            </div>
          </form>
        </Card>

        <Card title="How it works" style={{ "--index": 1 } as CSSProperties}>
          <ol
            className="quiet"
            style={{
              margin: 0,
              paddingLeft: "1.25rem",
              display: "grid",
              gap: "var(--sp-2)",
            }}
          >
            <li>Clones and inspects project structure, commits, and dependencies.</li>
            <li>Extracts key features, architecture, and engineering impact.</li>
            <li>Generates a Portfolio card, Doc sheet, Resume bullets, and Social post.</li>
            <li>Validates output against style rules and pauses for your approval.</li>
          </ol>
        </Card>

        <Card title="Keyboard Shortcuts" style={{ "--index": 2 } as CSSProperties}>
          <p className="quiet" style={{ margin: 0 }}>
            Press <Kbd>Enter</Kbd> to start scanning. Press <Kbd>Esc</Kbd> to clear input.
          </p>
        </Card>
      </div>
    </>
  );
}