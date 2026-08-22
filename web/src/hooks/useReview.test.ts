import { expect, it } from "vitest";
import { assetsOf, draftOf, listOf } from "./useReview";

/**
 * The two ways between the drafts of the service and the drafts of a person.
 *
 * A list is one text with one item on each line while a person edits it, so the
 * way out and the way back must give the same drafts. If they do not, an approval
 * sends a change that nobody made, and the curator reads that change as the voice
 * of the person.
 */

const ASSETS = {
  doc_sheet_md: "# A sheet\n\nOne line about it.",
  portfolio_card: {
    title: "A project",
    tagline: "One line about it.",
    stack: ["Python", "React"],
    highlights: ["It works.", "It is tested."],
    repo_url: "https://github.com/owner/name",
  },
  resume_bullets: ["Built the thing.", "Tested the thing."],
  social_draft: "A post about it.",
};

it("gives back the same drafts when nobody changed one", () => {
  expect(assetsOf(draftOf(ASSETS))).toEqual(ASSETS);
});

it("takes an empty line out of a list", () => {
  // A person leaves a gap while they think, and a gap is not an item.
  expect(listOf("One\n\n  \nTwo\n")).toEqual(["One", "Two"]);
});

it("makes an empty text into an empty list and not a list of one nothing", () => {
  expect(listOf("")).toEqual([]);
});
