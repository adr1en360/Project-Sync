/*
  The notes at the corner of the desk. A slip carries a receipt or an error.
*/

import { el } from "./dom.js";

/* A slip goes away by itself after this time. A slip that offers an action stays
   longer, because the operator must read it and then decide. */
const LINGER_MS = 9000;
const LINGER_WITH_ACTION_MS = 14000;

/**
 * Put one note at the corner of the desk.
 *
 * A note with the tone "bad" stays until the operator dismisses it. Every other
 * note goes away by itself.
 *
 * The fourth argument adds one button to the note, in the form
 * `{label, run}`. A delete uses it to offer an undo. The button runs the
 * function and then takes the note away.
 */
export function slip(title, message, tone = "ok", action = null) {
  const node = document.createElement("div");
  node.className = "slip";
  node.dataset.tone = tone;
  node.setAttribute("role", tone === "bad" ? "alert" : "status");

  const head = document.createElement("b");
  head.textContent = title;
  const text = document.createElement("span");
  text.textContent = message;
  node.append(head, text);

  const offered = action && action.label && typeof action.run === "function";
  if (offered) {
    const button = document.createElement("button");
    button.className = "slip__action";
    button.type = "button";
    button.textContent = action.label;
    button.addEventListener("click", () => {
      node.remove();
      action.run();
    });
    node.append(button);
  }

  const close = document.createElement("button");
  close.className = "btn btn--text";
  close.type = "button";
  close.textContent = "Dismiss";
  close.addEventListener("click", () => node.remove());
  node.append(close);

  el.slips.append(node);
  if (tone !== "bad") {
    setTimeout(() => node.remove(), offered ? LINGER_WITH_ACTION_MS : LINGER_MS);
  }
}
