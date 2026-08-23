import { useId, useState } from "react";
import { BULLET_TAGS, type BulletTag, type ResumeBullet } from "../api/types";
import { when } from "../format";
import type { Change } from "../hooks/useBullets";
import { BULLET_TAG } from "../labels";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Tag } from "../ui/Tag";
import { TextArea } from "../ui/TextArea";

/**
 * One bullet of the bank, with its editor.
 *
 * The row is closed until a person presses "Edit". The editor is in the page the
 * whole time and it opens by the reveal of animation 15, so the text of the
 * bullet does not jump when it opens and the browser animates a height it can
 * measure.
 *
 * The editor closes only when the service accepts the change. A row that closed
 * on the press would throw away what a person wrote if the request failed, and
 * the words of a person are the thing this screen is for.
 *
 * The classes named `rule-*` are the shared shape of a list of text rows, and
 * `ui.css` says so where they are defined. A bullet and a voice rule are the same
 * object on the screen: a paragraph, a line of facts under it, and its controls.
 */

type Props = {
  row: ResumeBullet;
  /** True while a request for this row is in flight. */
  busy: boolean;
  /** True while the confirmation of the copy control shows. */
  copied: boolean;
  onCopy: () => void;
  onSave: (change: Change) => Promise<boolean>;
  onRemove: () => Promise<boolean>;
};

export function BulletRow({ row, busy, copied, onCopy, onSave, onRemove }: Props) {
  const paneId = useId();
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const [text, setText] = useState(row.text);
  const [project, setProject] = useState(row.project);
  const [tags, setTags] = useState<readonly BulletTag[]>(row.tags);

  const clean = text.trim();
  const changed =
    clean !== row.text ||
    project.trim() !== row.project ||
    tags.length !== row.tags.length ||
    tags.some((tag) => !row.tags.includes(tag));

  /**
   * Open the editor with what the row holds now.
   *
   * The state is put here and not in an effect. The row is the truth, and a press
   * is the one moment the editor needs to read it, so an effect would only watch
   * for a moment that this function already knows.
   */
  const edit = () => {
    setText(row.text);
    setProject(row.project);
    setTags(row.tags);
    setArmed(false);
    setOpen(true);
  };

  const toggleTag = (tag: BulletTag) => {
    setTags((was) => (was.includes(tag) ? was.filter((one) => one !== tag) : [...was, tag]));
  };

  const save = async () => {
    // Only what changed is sent. The service marks the bullet as the work of a
    // person for any change, so a field that did not move must not be in the
    // request.
    const change: Change = {};
    if (clean !== row.text) {
      change.text = clean;
    }
    if (project.trim() !== row.project) {
      change.project = project.trim();
    }
    if (tags.length !== row.tags.length || tags.some((tag) => !row.tags.includes(tag))) {
      change.tags = tags;
    }
    if (await onSave(change)) {
      setOpen(false);
    }
  };

  return (
    <li className="rule-row">
      <p className="rule-text">{row.text}</p>

      <p className="rule-foot quiet">
        {row.project !== "" && <Tag tone="accent">{row.project}</Tag>}
        {row.tags.map((tag) => (
          <Tag key={tag}>{BULLET_TAG[tag]}</Tag>
        ))}
        {/* A person needs to know which lines are their own words and which a
            model wrote, because only one of the two is safe to send as it is. */}
        {row.is_manual_edit && <Tag tone="pass">Your words</Tag>}
        <span className="faint">{when(row.created_at)}</span>
      </p>

      {armed ? (
        <p className="row-controls">
          <span className="quiet">Remove this bullet for good?</span>
          <Button
            tone="danger"
            busy={busy}
            onClick={() => {
              void onRemove();
            }}
          >
            Remove it
          </Button>
          <Button
            tone="quiet"
            onClick={() => {
              setArmed(false);
            }}
          >
            Keep it
          </Button>
        </p>
      ) : (
        <p className="row-controls">
          <Button tone="quiet" onClick={onCopy}>
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button
            tone="quiet"
            aria-expanded={open}
            aria-controls={paneId}
            onClick={() => {
              if (open) {
                setOpen(false);
              } else {
                edit();
              }
            }}
          >
            {open ? "Close" : "Edit"}
          </Button>
          <Button
            tone="quiet"
            onClick={() => {
              setArmed(true);
            }}
          >
            Remove
          </Button>
        </p>
      )}

      <div className="reveal" data-open={open ? "true" : "false"} aria-hidden={open ? undefined : true}>
        <div className="reveal-body" id={paneId}>
          <div className="row-editor">
            <TextArea
              label="The bullet"
              rows={3}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
              }}
              error={clean === "" ? "A bullet needs some words." : null}
            />

            <Field
              label="Project"
              value={project}
              onChange={(event) => {
                setProject(event.target.value);
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
                    aria-pressed={tags.includes(tag)}
                    onClick={() => {
                      toggleTag(tag);
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
                busy={busy}
                disabled={busy || clean === "" || !changed}
                onClick={() => {
                  void save();
                }}
              >
                {busy ? "Saving" : "Save the change"}
              </Button>
              <Button
                tone="quiet"
                onClick={() => {
                  setOpen(false);
                }}
              >
                Cancel
              </Button>
            </p>
          </div>
        </div>
      </div>
    </li>
  );
}
