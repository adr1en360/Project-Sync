/*
  The notes at the corner of the desk. A slip carries a receipt or an error.
*/

import { el } from "./dom.js";

/**
 * Put one note at the corner of the desk.
 * A note with the tone "bad" stays until the operator dismisses it. Every
 * other note goes away by itself.
 */
export function slip(title, message, tone = "ok") {
  const node = document.createElement("div");
  node.className = "slip";
  node.dataset.tone = tone;
  node.setAttribute("role", tone === "bad" ? "alert" : "status");

  const head = document.createElement("b");
  head.textContent = title;
  const text = document.createElement("span");
  text.textContent = message;
  node.append(head, text);

  const close = document.createElement("button");
  close.className = "btn btn--ghost";
  close.type = "button";
  close.style.marginTop = "0.5rem";
  close.textContent = "Dismiss";
  close.addEventListener("click", () => node.remove());
  node.append(close);

  el.slips.append(node);
  if (tone !== "bad") setTimeout(() => node.remove(), 9000);
}
