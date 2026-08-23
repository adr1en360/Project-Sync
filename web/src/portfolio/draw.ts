import type { CardItem } from "../hooks/usePortfolio";

/**
 * The picture of a deck.
 *
 * The gallery draws its cards with the DOM, because the DOM gives real text that
 * a person can select and it answers the theme. A picture that leaves the app
 * can do neither, so this module draws the same card again on a canvas.
 *
 * The choice not to photograph the page is deliberate. A photograph needs every
 * font file inside the picture, and a font that does not arrive gives a picture
 * with the wrong letters and no error at all. Drawing puts every measure in this
 * one file, and it adds nothing to the size of the download.
 *
 * The palette here is a constant and it does not read the tokens. A picture
 * leaves the app, so it cannot ask its reader for a theme. It takes the mode of
 * the person who made it, and then it holds that mode for ever.
 */

export const CARD_W = 1200;
export const CARD_H = 630;

/** The space between two cards of one deck picture. */
const GAP = 24;

const PAD = 72;

/** The width of the accent bar down the left edge. */
const BAR = 8;

const SERIF = '"Instrument Serif", Georgia, serif';
const SANS = '"Geist Sans", system-ui, sans-serif';
const MONO = '"Geist Mono", ui-monospace, monospace';

export type Ink = {
  back: string;
  ink: string;
  quiet: string;
  line: string;
  chip: string;
  accent: string;
};

const LIGHT = {
  back: "#fbfbfa",
  ink: "#232327",
  quiet: "#6d6d75",
  line: "#e4e4e0",
  chip: "#f0f0ed",
};

const DARK = {
  back: "#16171b",
  ink: "#f2f2f0",
  quiet: "#9b9ba3",
  line: "#2b2c32",
  chip: "#212228",
};

/**
 * The accent of each preset, as one fixed colour.
 *
 * The tokens hold the accent as an OkLCh value with a live hue, and a canvas
 * cannot be trusted to read that form in every browser. A picture with an
 * unreadable colour keeps the colour before it, and that failure is silent. So
 * each preset names one colour here.
 */
const ACCENT: Record<string, string> = {
  azure: "#2563eb",
  violet: "#7c3aed",
  rose: "#e11d48",
};

export function inkOf(dark: boolean, hue: string): Ink {
  const accent = ACCENT[hue] === undefined ? ACCENT.azure : ACCENT[hue];
  return { ...(dark ? DARK : LIGHT), accent };
}

/** Read the mode and the preset that the person is looking at now. */
export function currentInk(): Ink {
  const root = document.documentElement;
  const mode = root.getAttribute("data-theme");
  const dark =
    mode === "dark" ||
    (mode === null &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const hue = root.getAttribute("data-hue");
  return inkOf(dark, hue === null ? "azure" : hue);
}

/**
 * Break one text into lines that fit a width.
 *
 * `measure` is a parameter and not a call on the context, so a test can prove
 * the arithmetic with no canvas at all. A canvas is absent in the test
 * environment, and this function holds the part that can be wrong.
 *
 * A text that does not fit in the lines available ends with an elision mark, so
 * a person can see that there is more.
 */
export function wrapLines(
  text: string,
  width: number,
  measure: (part: string) => number,
  lines = 2,
): string[] {
  const words = text.split(/\s+/).filter((word) => word !== "");
  const out: string[] = [];
  let line = "";
  let index = 0;

  while (index < words.length) {
    const word = words[index];
    const next = line === "" ? word : `${line} ${word}`;
    // One word that is wider than the whole line still goes on the line. The
    // other answer is a loop that never ends.
    if (line === "" || measure(next) <= width) {
      line = next;
      index += 1;
      continue;
    }
    out.push(line);
    line = "";
    if (out.length === lines) {
      break;
    }
  }

  if (line !== "" && out.length < lines) {
    out.push(line);
    index = words.length;
  }
  if (index < words.length && out.length > 0) {
    out[out.length - 1] = `${out[out.length - 1]}\u2026`;
  }
  return out;
}

/** Take the host and the owner off an address, and leave `owner/name`. */
export function shortRepo(url: string): string {
  const cut = url.replace(/^https?:\/\//, "").replace(/^(www\.)?github\.com\//, "");
  return cut.replace(/\.git$/, "").replace(/\/$/, "");
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  // `roundRect` is new, so a browser without it gets a square chip and not a
  // missing one.
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.rect(x, y, w, h);
}

/** Draw the stack as chips on as many rows as they need. Gives the new depth. */
function drawChips(
  ctx: CanvasRenderingContext2D,
  stack: readonly string[],
  left: number,
  top: number,
  width: number,
  ink: Ink,
): number {
  ctx.font = `500 20px ${MONO}`;
  let x = left;
  let y = top;
  for (const name of stack.slice(0, 8)) {
    const w = ctx.measureText(name).width + 28;
    if (x + w > left + width && x > left) {
      x = left;
      y += 44;
    }
    ctx.fillStyle = ink.chip;
    roundRect(ctx, x, y - 23, w, 34, 8);
    ctx.fill();
    ctx.fillStyle = ink.ink;
    ctx.fillText(name, x + 14, y);
    x += w + 10;
  }
  return y;
}

/**
 * Draw one card at the origin of the context.
 *
 * The caller moves the origin, so one context can hold a whole deck.
 */
export function drawCard(
  ctx: CanvasRenderingContext2D,
  item: CardItem,
  ink: Ink,
): void {
  const card = item.card;
  const left = PAD + BAR;
  const right = CARD_W - PAD;
  const width = right - left;
  const foot = CARD_H - PAD;

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = ink.back;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // The one mark of the product on the picture, so a person who sees the picture
  // by itself knows where it came from.
  ctx.fillStyle = ink.accent;
  ctx.fillRect(0, 0, BAR, CARD_H);

  let y = PAD + 20;

  ctx.font = `500 22px ${MONO}`;
  ctx.fillStyle = ink.quiet;
  ctx.fillText(item.repoName, left, y);
  y += 62;

  ctx.font = `400 66px ${SERIF}`;
  ctx.fillStyle = ink.ink;
  for (const line of wrapLines(card.title, width, (part) => ctx.measureText(part).width, 2)) {
    ctx.fillText(line, left, y);
    y += 74;
  }
  y += 4;

  ctx.font = `400 28px ${SANS}`;
  ctx.fillStyle = ink.quiet;
  for (const line of wrapLines(card.tagline, width, (part) => ctx.measureText(part).width, 2)) {
    ctx.fillText(line, left, y);
    y += 40;
  }
  y += 26;

  y = drawChips(ctx, card.stack, left, y, width, ink) + 52;

  ctx.font = `400 26px ${SANS}`;
  for (const point of card.highlights) {
    // A line that would run into the foot is not drawn. The card is one picture
    // and it does not scroll, so it must end where the space ends.
    if (y > foot - 74) {
      break;
    }
    const lines = wrapLines(point, width - 34, (part) => ctx.measureText(part).width, 1);
    if (lines.length === 0) {
      continue;
    }
    ctx.fillStyle = ink.accent;
    ctx.fillRect(left + 1, y - 11, 10, 10);
    ctx.fillStyle = ink.ink;
    ctx.fillText(lines[0], left + 34, y);
    y += 40;
  }

  ctx.fillStyle = ink.line;
  ctx.fillRect(left, foot - 44, width, 1);
  ctx.font = `400 22px ${MONO}`;
  ctx.fillStyle = ink.quiet;
  ctx.fillText(shortRepo(card.repo_url), left, foot);
  ctx.textAlign = "right";
  ctx.fillText("ProjectSync", right, foot);

  ctx.restore();
}

/**
 * Wait for the three type families.
 *
 * A canvas draws with the fallback family if the real one has not arrived, and
 * it gives no warning. The set of fonts is absent in the test environment, and
 * that is not a failure.
 */
async function readyFonts(): Promise<void> {
  const fonts: FontFaceSet | undefined = document.fonts;
  if (fonts === undefined || typeof fonts.ready !== "object") {
    return;
  }
  try {
    await fonts.ready;
  } catch {
    // A set of fonts that refuses is still a page that can draw.
  }
}

function surface(width: number, height: number): CanvasRenderingContext2D | null {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  // The test environment has no canvas, and the interface says so instead of
  // failing. Every caller answers null.
  return canvas.getContext("2d");
}

/** Draw every card of the deck into one tall picture. Gives a PNG address. */
export async function deckImage(
  items: readonly CardItem[],
  ink: Ink,
): Promise<string | null> {
  if (items.length === 0) {
    return null;
  }
  await readyFonts();
  const height = items.length * CARD_H + (items.length - 1) * GAP;
  const ctx = surface(CARD_W, height);
  if (ctx === null) {
    return null;
  }
  ctx.fillStyle = ink.back;
  ctx.fillRect(0, 0, CARD_W, height);
  items.forEach((item, index) => {
    ctx.save();
    ctx.translate(0, index * (CARD_H + GAP));
    drawCard(ctx, item, ink);
    ctx.restore();
  });
  return ctx.canvas.toDataURL("image/png");
}

/** Draw one picture for each card. The print path puts one on each page. */
export async function cardImages(
  items: readonly CardItem[],
  ink: Ink,
): Promise<string[]> {
  await readyFonts();
  const out: string[] = [];
  for (const item of items) {
    const ctx = surface(CARD_W, CARD_H);
    if (ctx === null) {
      return [];
    }
    drawCard(ctx, item, ink);
    out.push(ctx.canvas.toDataURL("image/png"));
  }
  return out;
}
