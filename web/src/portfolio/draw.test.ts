import { afterEach, expect, it, vi } from "vitest";
import type { CardItem } from "../hooks/usePortfolio";
import {
  cardImages,
  currentInk,
  deckImage,
  drawCard,
  inkOf,
  shortRepo,
  wrapLines,
} from "./draw";

/**
 * The drawing.
 *
 * A picture that comes out wrong comes out wrong in silence, so the parts that
 * can be wrong are tested apart from the canvas: the arithmetic of the lines, the
 * short form of an address, and the palette. The test environment has no canvas
 * at all, which is also the state of an old browser, so the last two tests prove
 * that the absence gives an answer and not a failure.
 */

/** Each letter is 10 wide. This is the `measure` that a canvas would give. */
const wide = (part: string) => part.length * 10;

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-hue");
});

it("breaks a text on the last word that fits", () => {
  expect(wrapLines("one two three", 100, wide, 2)).toEqual(["one two", "three"]);
});

it("marks a text that does not fit in the lines available", () => {
  expect(wrapLines("aaa bbb ccc ddd", 70, wide, 1)).toEqual(["aaa bbb\u2026"]);
});

it("puts one word that is wider than the line on the line", () => {
  // The other answer is a loop that never ends.
  expect(wrapLines("aaaaaaaaaa", 10, wide, 2)).toEqual(["aaaaaaaaaa"]);
});

it("gives no line for no text", () => {
  expect(wrapLines("   ", 100, wide, 2)).toEqual([]);
});

it("takes the host and the owner off an address", () => {
  expect(shortRepo("https://github.com/owner/name")).toBe("owner/name");
  expect(shortRepo("https://www.github.com/owner/name.git")).toBe("owner/name");
  expect(shortRepo("owner/name")).toBe("owner/name");
});

it("gives each preset its own accent and each mode its own paper", () => {
  expect(inkOf(false, "azure").accent).toBe("#2563eb");
  expect(inkOf(true, "rose").accent).toBe("#e11d48");
  expect(inkOf(false, "violet").back).toBe("#fbfbfa");
  expect(inkOf(true, "violet").back).toBe("#16171b");
});

it("falls back to the first preset for a hue it does not know", () => {
  expect(inkOf(false, "teal").accent).toBe(inkOf(false, "azure").accent);
});

it("reads the mode and the preset off the page", () => {
  document.documentElement.setAttribute("data-theme", "dark");
  document.documentElement.setAttribute("data-hue", "violet");
  const ink = currentInk();
  expect(ink.back).toBe("#16171b");
  expect(ink.accent).toBe("#7c3aed");
});

const ITEM: CardItem = {
  txId: "tx-1",
  repoName: "owner/beacon",
  createdAt: "2026-08-22T10:00:00Z",
  status: "COMPLETED",
  card: {
    title: "Beacon",
    tagline: "It watches the thing and it tells you.",
    stack: ["Python", "FastAPI"],
    highlights: ["It reads the log.", "It answers in one second."],
    repo_url: "https://github.com/owner/beacon",
  },
};

/** A context that keeps every text it is asked to draw. */
function fake() {
  const said: string[] = [];
  const ctx = {
    canvas: { toDataURL: () => "data:image/png;base64,fake" },
    save() {},
    restore() {},
    translate() {},
    beginPath() {},
    rect() {},
    fill() {},
    fillRect() {},
    measureText: (part: string) => ({ width: part.length * 12 }),
    fillText: (part: string) => {
      said.push(part);
    },
    set font(_v: string) {},
    set fillStyle(_v: string) {},
    set textAlign(_v: string) {},
    set textBaseline(_v: string) {},
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, said };
}

it("draws the name of the repository, the title and the address", () => {
  const { ctx, said } = fake();
  drawCard(ctx, ITEM, inkOf(false, "azure"));
  expect(said).toContain("owner/beacon");
  expect(said).toContain("Beacon");
  expect(said).toContain("ProjectSync");
  // Every point of the card is on the card, because there is room for three.
  expect(said).toContain("It reads the log.");
});

it("gives no picture when the browser has no canvas", async () => {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    value: () => null,
    writable: true,
  });
  await expect(deckImage([ITEM], inkOf(false, "azure"))).resolves.toBeNull();
  await expect(cardImages([ITEM], inkOf(false, "azure"))).resolves.toEqual([]);
});

it("gives no picture for an empty deck", async () => {
  await expect(deckImage([], inkOf(false, "azure"))).resolves.toBeNull();
});
