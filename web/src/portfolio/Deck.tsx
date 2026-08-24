import type { PointerEvent as Drag } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CardItem } from "../hooks/usePortfolio";
import { Button } from "../ui/Button";
import { CardFace } from "./CardFace";
import { cardImages, currentInk, deckImage } from "./draw";

/**
 * The deck.
 *
 * A person answers one card at a time, so a choice is one motion each. The
 * pointer, the two arrow keys and the two buttons all give the same answer,
 * because a swipe by itself is not a control that everybody can use.
 *
 * What they keep becomes one picture. The picture comes before the PDF, because a
 * picture is one thing to get right and it is the thing that a person pastes into
 * a message. The print page then holds the same pictures, one on each page, so
 * the PDF needs nothing to be right in two modes and on every paper size.
 */

/** How far a card must travel before a release counts as an answer. */
const THROW = 90;

type Props = {
  items: readonly CardItem[];
  onClose: () => void;
};

/**
 * What came out of the drawing.
 *
 * One state and not three. `null` means the drawing has not finished, so the flag
 * that the interface needs is derived and no effect has to set it. `deck` is null
 * inside a finished result when the browser has no canvas, which is a different
 * thing from a drawing that is still running.
 */
type Made = {
  deck: string | null;
  pages: readonly string[];
};

export function Deck({ items, onClose }: Props) {
  const [at, setAt] = useState(0);
  const [kept, setKept] = useState<readonly string[]>([]);
  const [dx, setDx] = useState(0);
  const [made, setMade] = useState<Made | null>(null);
  const host = useRef<HTMLDivElement | null>(null);
  const from = useRef<number | null>(null);

  const done = at >= items.length;
  const card = done ? null : items[at];

  const chosen = useMemo(
    () => items.filter((item) => kept.includes(item.txId)),
    [items, kept],
  );

  const drawing = done && chosen.length > 0 && made === null;
  const image = made === null ? null : made.deck;
  const pages = made === null ? [] : made.pages;

  const answer = useCallback(
    (keep: boolean) => {
      const here = items[at];
      setDx(0);
      if (keep && here !== undefined) {
        setKept((was) => [...was, here.txId]);
      }
      setAt((was) => was + 1);
    },
    [at, items],
  );

  const restart = useCallback(() => {
    setAt(0);
    setKept([]);
    setMade(null);
  }, []);

  // The focus goes into the overlay, and it returns to the control that opened
  // it. A person who closes a dialog must not lose their place on the page.
  useEffect(() => {
    const opener = document.activeElement;
    host.current?.focus();
    return () => {
      if (opener instanceof HTMLElement) {
        opener.focus();
      }
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "Tab") {
        trap(host.current, event);
        return;
      }
      if (done) {
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        answer(true);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        answer(false);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [answer, done, onClose]);

  // The pictures are drawn one time, when the last card is answered.
  useEffect(() => {
    if (!done || chosen.length === 0) {
      return;
    }
    let live = true;
    const ink = currentInk();
    void (async () => {
      const deck = await deckImage(chosen, ink);
      const shots = await cardImages(chosen, ink);
      if (live) {
        setMade({ deck, pages: shots });
      }
    })();
    return () => {
      live = false;
    };
  }, [chosen, done]);

  function grab(event: Drag<HTMLDivElement>) {
    if (done) {
      return;
    }
    from.current = event.clientX;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A pointer that cannot be captured still gives its moves to the element,
      // and the release below resets the card either way.
    }
  }

  function move(event: Drag<HTMLDivElement>) {
    if (from.current === null) {
      return;
    }
    setDx(event.clientX - from.current);
  }

  function release() {
    if (from.current === null) {
      return;
    }
    from.current = null;
    if (Math.abs(dx) < THROW) {
      setDx(0);
      return;
    }
    answer(dx > 0);
  }

  function toPaper() {
    if (typeof window.print === "function") {
      window.print();
    }
  }

  return (
    <div
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Build a deck"
      ref={host}
      tabIndex={-1}
    >
      <div className="sheet-box">
        <header className="sheet-head">
          <div>
            <h2 className="card-title">{done ? "Your deck" : "Keep it or skip it"}</h2>
            <p className="quiet sheet-note">
              {done
                ? chosen.length === 1
                  ? "One card is in the deck."
                  : `${chosen.length} cards are in the deck.`
                : `Card ${at + 1} of ${items.length}`}
            </p>
          </div>
          <Button tone="quiet" onClick={onClose}>
            Close
          </Button>
        </header>

        {card !== null && (
          <>
            <div
              className="sheet-card"
              style={{ transform: `translateX(${dx}px) rotate(${dx / 40}deg)` }}
              onPointerDown={grab}
              onPointerMove={move}
              onPointerUp={release}
              onPointerCancel={release}
            >
              <CardFace card={card.card} repoName={card.repoName} />
            </div>
            <div className="sheet-foot">
              <Button onClick={() => answer(false)}>Skip</Button>
              <p className="faint sheet-hint">
                Drag the card, or use the left and right arrow keys.
              </p>
              <Button tone="primary" onClick={() => answer(true)}>
                Keep
              </Button>
            </div>
          </>
        )}

        {done && (
          <div className="sheet-done">
            {chosen.length === 0 ? (
              <p className="quiet">You skipped every card. Start again to keep some.</p>
            ) : (
              <ul className="deck-strip">
                {chosen.map((item) => (
                  <li key={item.txId}>
                    <CardFace card={item.card} repoName={item.repoName} />
                  </li>
                ))}
              </ul>
            )}

            <div className="sheet-foot">
              <Button onClick={restart}>Start again</Button>
              {chosen.length > 0 &&
                (image === null ? (
                  <p className="faint sheet-hint">
                    {drawing
                      ? "Drawing the picture"
                      : "This browser cannot draw the picture, so use the print page."}
                  </p>
                ) : (
                  <a
                    className="btn btn-primary"
                    href={image}
                    download="projectsync-deck.png"
                  >
                    Save the picture
                  </a>
                ))}
              {chosen.length > 0 && <Button onClick={toPaper}>Print the deck</Button>}
            </div>
          </div>
        )}
      </div>

      {/* The print page. It is off the screen until a person prints, and then it
          is the only thing on the paper. One picture on each page. */}
      <div className="print-deck" aria-hidden="true">
        {pages.length > 0
          ? pages.map((src, index) => (
              <img key={index} src={src} alt="" className="print-page" />
            ))
          : chosen.map((item) => (
              <div key={item.txId} className="print-page">
                <CardFace card={item.card} repoName={item.repoName} />
              </div>
            ))}
      </div>
    </div>
  );
}

/**
 * Keep the focus inside the overlay.
 *
 * The overlay covers the page, so a Tab that reached the page under it would put
 * the focus on a control that a person cannot see.
 */
function trap(node: HTMLElement | null, event: KeyboardEvent): void {
  if (node === null) {
    return;
  }
  const able = node.querySelectorAll<HTMLElement>(
    'button, a[href], [tabindex]:not([tabindex="-1"])',
  );
  if (able.length === 0) {
    return;
  }
  const first = able[0];
  const last = able[able.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
