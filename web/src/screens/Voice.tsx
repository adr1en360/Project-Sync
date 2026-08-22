import { EmptyState } from "../ui/EmptyState";
import { Tag } from "../ui/Tag";
import { ScreenHead } from "./ScreenHead";

/**
 * The rules that change what the model writes.
 *
 * Stage F9 builds the manager. A rule has three states, and the words for them
 * are Suggested, On and Off.
 */

export function Voice() {
  return (
    <>
      <ScreenHead
        title="Your voice"
        lede="A rule is one instruction that goes into every run after it. A rule can come from an edit you made on the review desk."
      />

      <div
        style={{
          display: "flex",
          gap: "var(--sp-2)",
          marginBottom: "var(--sp-6)",
        }}
      >
        <Tag tone="accent">Suggested</Tag>
        <Tag tone="pass">On</Tag>
        <Tag tone="quiet">Off</Tag>
      </div>

      <EmptyState title="No rules yet">
        Approve a run with an edit, and ProjectSync suggests the rule behind
        that edit. Stage F9 brings the manager for all three states.
      </EmptyState>
    </>
  );
}