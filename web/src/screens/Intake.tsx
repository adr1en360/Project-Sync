import { useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import { triggerSync } from "../api/client";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Field } from "../ui/Field";
import { Kbd } from "../ui/Kbd";
import { ScreenHead } from "./ScreenHead";

/**
 * Step 1. The repository.
 *
 * The form sends `POST /api/v1/trigger-sync`, and the service answers at once
 * with the id of the transaction. The graph then runs behind the request, so
 * this screen hands the id to the shell and the shell opens the run screen.
 *
 * The field sends the text as the person wrote it. The service accepts every
 * form, from `owner/name` to a deep URL, and it holds the one judgement of what
 * a repository name is. A second judgement here could only disagree with it.
 */

type Props = {
  /** Called with the id of the transaction when the service accepts the form. */
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
      setError("Give the owner and the name of a repository.");
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
        title="Start from a finished repository"
        lede="Give the owner and the name of a repository that is ready to show. ProjectSync reads it, writes four drafts, and stops for you to approve them."
      />

      <div className="bento stagger">
        <Card
          title="The repository"
          className="wide"
          style={{ "--index": 0 } as CSSProperties}
        >
          {/* A form, so Enter in the field starts the run and the browser gives
              the keyboard path for nothing. */}
          <form onSubmit={submit} style={{ display: "grid", gap: "var(--sp-5)" }}>
            <Field
              label="Owner and name"
              placeholder="owner/repository"
              mono
              autoComplete="off"
              spellCheck={false}
              help="A public repository, or a private one that your token can read."
              error={error ?? undefined}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={keyDown}
            />
            <div style={{ display: "flex", gap: "var(--sp-3)", alignItems: "center" }}>
              <Button type="submit" tone="primary" busy={busy}>
                {busy ? "Reading the repository" : "Read the repository"}
              </Button>
              <span className="faint" style={{ fontSize: "var(--step--1)" }}>
                The run stops before anything is published.
              </span>
            </div>
          </form>
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