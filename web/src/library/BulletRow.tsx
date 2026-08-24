import { useId, useState } from "react";
import { BULLET_TAGS, type BulletTag, type ResumeBullet } from "../api/types";
import { day } from "../format";
import type { Change } from "../hooks/useBullets";
import { BULLET_TAG } from "../labels";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Tag } from "../ui/Tag";
import { TextArea } from "../ui/TextArea";
import { CheckIcon, CloseIcon, CopyIcon, PenIcon } from "../ui/icons";

type Props = {
  row: ResumeBullet;
  /** True while a request for this row is in flight. */
  busy: boolean;
  /** True while the copy feedback is active. */
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
    <li className="bank-row">
      <div className="bank-main">
        <p className="bank-text">{row.text}</p>

        {(row.tags.length > 0 || row.is_manual_edit) && (
          <p className="bank-marks">
            {row.is_manual_edit && <Tag tone="pass">Your edit</Tag>}
            {row.tags.map((tag) => (
              <Tag key={tag}>{BULLET_TAG[tag]}</Tag>
            ))}
          </p>
        )}

        {armed && (
          <div className="row-controls">
            <span className="quiet">Delete this bullet?</span>
            <Button
              tone="danger"
              busy={busy}
              onClick={() => {
                void onRemove();
              }}
            >
              Delete
            </Button>
            <Button
              tone="quiet"
              onClick={() => {
                setArmed(false);
              }}
            >
              Keep
            </Button>
          </div>
        )}
      </div>

      <span className="bank-when mono">{day(row.created_at)}</span>

      {!armed && (
        <span className="bank-acts">
          <button
            type="button"
            className="icon-btn"
            onClick={onCopy}
            aria-label={copied ? "Copied to clipboard" : `Copy: ${row.text}`}
            title={copied ? "Copied" : "Copy bullet"}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>

          <button
            type="button"
            className="icon-btn"
            aria-expanded={open}
            aria-controls={paneId}
            aria-label={`Edit: ${row.text}`}
            title="Edit bullet"
            onClick={() => {
              if (open) {
                setOpen(false);
              } else {
                edit();
              }
            }}
          >
            <PenIcon />
          </button>

          <button
            type="button"
            className="icon-btn"
            aria-label={`Delete: ${row.text}`}
            title="Delete bullet"
            onClick={() => {
              setArmed(true);
            }}
          >
            <CloseIcon />
          </button>
        </span>
      )}

      <div className="reveal" data-open={open ? "true" : "false"} aria-hidden={open ? undefined : true}>
        <div className="reveal-body" id={paneId}>
          <div className="row-editor">
            <TextArea
              label="Bullet text"
              rows={3}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
              }}
              error={clean === "" ? "Bullet text cannot be empty." : null}
            />

            <Field
              label="Project / Repository"
              value={project}
              onChange={(event) => {
                setProject(event.target.value);
              }}
              help="Repository or project name this bullet belongs to."
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
                {busy ? "Saving..." : "Save changes"}
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
