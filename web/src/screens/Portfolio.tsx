import type { CSSProperties } from "react";
import { useCallback, useState } from "react";
import { useFlip } from "../hooks/useFlip";
import type { Sort } from "../hooks/usePortfolio";
import { SORT_LABEL, SORTS, usePortfolio } from "../hooks/usePortfolio";
import { STATUS, STATUS_TONE } from "../labels";
import { CardFace } from "../portfolio/CardFace";
import { Deck } from "../portfolio/Deck";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { ErrorCallout } from "../ui/ErrorCallout";
import { Skeleton } from "../ui/Skeleton";
import { Tag } from "../ui/Tag";
import { ScreenHead } from "./ScreenHead";

/**
 * Step 3: Portfolio Card Gallery.
 *
 * Displays visual project highlight cards generated from approved repository runs.
 * Supports interactive 3D card flipping, tag filtering, custom card deck compilation,
 * and high-resolution PNG image export.
 */

export function Portfolio() {
  const gallery = usePortfolio();
  const [deck, setDeck] = useState(false);
  const host = useFlip(`${gallery.tech === null ? "all" : gallery.tech}:${gallery.sort}`);
  const close = useCallback(() => {
    setDeck(false);
  }, []);

  const count = gallery.picked.length;

  return (
    <>
      <ScreenHead
        title="Project Portfolio"
        lede="Visual highlight cards for your approved projects. Select cards to compile a custom deck and export high-resolution presentation images."
        actions={
          !gallery.loading ? (
            <>
              {gallery.shown.length > 0 && (
                <>
                  <label className="sort">
                    <span className="sr-only">Card sort order</span>
                    <select
                      className="field-input"
                      value={gallery.sort}
                      onChange={(event) => {
                        gallery.setSort(event.target.value as Sort);
                      }}
                    >
                      {SORTS.map((order) => (
                        <option key={order} value={order}>
                          {SORT_LABEL[order]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <span className="quiet tools-note">
                    {count === 0
                      ? `The deck takes all ${gallery.shown.length}`
                      : `The deck takes the ${count} you chose`}
                  </span>

                  {count > 0 && (
                    <Button tone="quiet" onClick={gallery.clear}>
                      Clear the choice
                    </Button>
                  )}
                </>
              )}
              <Button
                tone="primary"
                onClick={() => {
                  setDeck(true);
                }}
                disabled={gallery.shown.length === 0}
              >
                Build a deck
              </Button>
            </>
          ) : undefined
        }
      />

      {gallery.techs.length > 0 && (
        <div className="filter-bar">
          <div className="chip-row" role="group" aria-label="Filter by technology">
            <button
              type="button"
              className="chip"
              aria-pressed={gallery.tech === null}
              onClick={() => {
                gallery.setTech(null);
              }}
            >
              Everything
            </button>
            {gallery.techs.map((name) => (
              <button
                key={name}
                type="button"
                className="chip mono"
                aria-pressed={gallery.tech === name}
                onClick={() => {
                  gallery.setTech(gallery.tech === name ? null : name);
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {gallery.error !== null && (
        <ErrorCallout error={gallery.error} style={{ margin: "var(--sp-4) 0" }} />
      )}

      {gallery.loading ? (
        <div className="bento cards stagger" aria-busy="true">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="card face-wait"
              style={{ "--index": index } as CSSProperties}
            >
              <Skeleton height="0.875rem" width="40%" />
              <Skeleton height="var(--step-3)" width="80%" />
              <Skeleton height="1rem" />
              <Skeleton height="1rem" width="55%" />
              <Skeleton height="1.75rem" width="70%" radius="999px" />
            </div>
          ))}
        </div>
      ) : gallery.items.length === 0 ? (
        <EmptyState title="No card yet">
          A card arrives here when you approve a run on the review desk.
        </EmptyState>
      ) : gallery.shown.length === 0 ? (
        <EmptyState
          title="Nothing is built with that"
          action={
            <Button
              onClick={() => {
                gallery.setTech(null);
              }}
            >
              Show everything
            </Button>
          }
        >
          No portfolio card uses the selected technology.
        </EmptyState>
      ) : (
        <div className="bento cards stagger" ref={host}>
          {gallery.shown.map((item, index) => {
            const on = gallery.picked.includes(item.txId);
            return (
              <div
                key={item.txId}
                className="pick"
                data-flip={item.txId}
                data-on={on}
                style={{ "--index": index } as CSSProperties}
              >
                <CardFace
                  card={item.card}
                  repoName={item.repoName}
                  foot={
                    <div className="pick-foot">
                      <Tag tone={STATUS_TONE[item.status]}>{STATUS[item.status]}</Tag>
                      <Button
                        tone={on ? "primary" : "quiet"}
                        aria-pressed={on}
                        onClick={() => {
                          gallery.toggle(item.txId);
                        }}
                      >
                        {on ? "Chosen" : "Choose"}
                      </Button>
                    </div>
                  }
                />
              </div>
            );
          })}
        </div>
      )}

      {deck && <Deck items={gallery.chosen} onClose={close} />}
    </>
  );
}
