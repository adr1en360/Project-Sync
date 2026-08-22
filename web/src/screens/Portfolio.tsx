import type { CSSProperties } from "react";
import { EmptyState } from "../ui/EmptyState";
import { Skeleton } from "../ui/Skeleton";
import { ScreenHead } from "./ScreenHead";

/**
 * The gallery of finished work.
 *
 * Stage F6 builds the cards, the selection and the print deck. The skeletons
 * here show the shape that the cards will take.
 */

export function Portfolio() {
  return (
    <>
      <ScreenHead
        title="Portfolio"
        lede="One card for each project you approved. Select the ones for a role and print them as a deck."
      />

      <div className="bento stagger">
        {[0, 1, 2].map((index) => (
          <div key={index} className="card" style={
              { display: "grid", gap: "var(--sp-4)", "--index": index } as CSSProperties
            }>
            <Skeleton height="var(--step-2)" width="70%" />
            <Skeleton height="1rem" />
            <Skeleton height="1rem" width="85%" />
            <Skeleton height="1rem" width="40%" />
          </div>
        ))}
      </div>

      <div style={{ marginTop: "var(--sp-8)" }}>
        <EmptyState title="Nothing to show yet">
          A card arrives here when you approve a run. Stage F6 makes the cards
          real and adds the print deck.
        </EmptyState>
      </div>
    </>
  );
}