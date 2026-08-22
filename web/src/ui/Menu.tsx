import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { CaretIcon } from "./icons";

/**
 * A menu that holds one choice.
 *
 * The control is a button and a list of radio items, so a screen reader says
 * which value is on. The menu closes on `Esc`, on a press outside it, and after
 * a choice, and the focus goes back to the button each time.
 *
 * A `select` element would be smaller. It cannot hold the colour of each value,
 * and that colour is how a person chooses an accent by eye.
 */

export type MenuItem = {
  id: string;
  label: string;
  /** The hue of the swatch of the item. Nothing means no swatch. */
  hue?: number;
};

type Props = {
  /** What the button shows. */
  trigger: ReactNode;
  /** What a screen reader says for the button. It names the value that is on. */
  ariaLabel: string;
  title?: string;
  items: readonly MenuItem[];
  current: string;
  onPick: (id: string) => void;
};

export function Menu({ trigger, ariaLabel, title, items, current, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    button.current?.focus();
  }, []);

  // A press outside the menu closes it. The event is `pointerdown` and not
  // `click`, so the menu is gone before the control under the pointer answers.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onDown = (event: PointerEvent) => {
      const box = wrap.current;
      if (box !== null && !box.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  // The value that is on takes the focus, so the keyboard starts at the value
  // that the person already chose.
  useEffect(() => {
    if (!open) {
      return;
    }
    const box = list.current;
    if (box === null) {
      return;
    }
    const checked = box.querySelector<HTMLButtonElement>('[aria-checked="true"]');
    (checked ?? box.querySelector<HTMLButtonElement>('[role="menuitemradio"]'))?.focus();
  }, [open]);

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const box = list.current;
    if (box === null) {
      return;
    }
    const buttons = Array.from(
      box.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'),
    );
    const here = buttons.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = (here + step + buttons.length) % buttons.length;
      buttons[next]?.focus();
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      buttons[0]?.focus();
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      buttons[buttons.length - 1]?.focus();
    }
  };

  return (
    <div className="menu-wrap" ref={wrap}>
      <button
        ref={button}
        type="button"
        className="btn btn-quiet menu-trigger"
        aria-label={ariaLabel}
        title={title ?? ariaLabel}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {trigger}
        <CaretIcon />
      </button>

      {open && (
        <div
          ref={list}
          className="menu-pop"
          role="menu"
          aria-label={ariaLabel}
          onKeyDown={onListKeyDown}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="menu-item"
              role="menuitemradio"
              aria-checked={item.id === current}
              onClick={() => {
                onPick(item.id);
                close();
              }}
            >
              {item.hue !== undefined && (
                <span
                  className="hue-dot"
                  aria-hidden="true"
                  style={{ "--dot-h": item.hue } as CSSProperties}
                />
              )}
              <span>{item.label}</span>
              {item.id === current && (
                <span className="menu-mark mono" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}