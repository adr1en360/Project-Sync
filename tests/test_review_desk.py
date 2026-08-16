"""The tests of the review desk.

The interface is plain ES modules and plain stylesheets, with no build step, so
`pytest` cannot import it. The first test calls Node on `desk_harness.mjs`, which
gives the modules a fake DOM and a fake service, and then reads the page that
they wrote. That test passes over itself when the machine has no Node. Node is
not a dependency of the product: the container serves the files, and the browser
reads them. Node is here only to test them.

The tests after it need no Node. The first three read `index.html` and the
folders beside it, and they hold the page and the files to the same list. The
five after those read the declarations in the stylesheets, because no other test
in this project reads one. The last four read the two palettes and they measure
the contrast of each pair of colours that the design puts together.

Why these tests are necessary: a fault in the interface does not stop the API. A
module that throws at import stops the whole page, and each request still gets
the same answer as before. A stylesheet that the page names with one wrong letter
gives a page with no design, and again each request gets the same answer. A token
with no value, or a hex colour with five digits, takes one part of the design
away and leaves the rest. A dark palette that forgets one role gives one colour
of the morning on a page that is dark. So a probe of the API cannot find any of
them. One such fault was in the interface for a full day. See
`docs/VERIFICATION_LEDGER.md` rows 5.1 and 5.6.
"""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

import pytest

HARNESS = Path(__file__).parent / "desk_harness.mjs"

STATIC = Path(__file__).parent.parent / "static"

PAGE = STATIC / "index.html"

# Each `href` or `src` that points into the folder that FastAPI serves. An
# address that starts with `http` belongs to another host, so the group below
# does not take it.
LOCAL_ASSET = re.compile(r'(?:href|src)="/static/([^"]+)"')

NODE = shutil.which("node")


@pytest.mark.skipif(
    NODE is None,
    reason="This test needs Node. The product does not need Node.",
)
def test_the_review_desk_boots_and_answers_each_action():
    """Run the harness and give the output when a check fails."""
    result = subprocess.run(
        [NODE, str(HARNESS)],
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )

    report = f"{result.stdout}\n{result.stderr}".strip()
    assert result.returncode == 0, f"The review desk harness failed.\n\n{report}"

    # A harness that starts, throws, and gives exit code 0 must not pass. So the
    # test also looks for the line that reports the count.
    assert "checks passed, 0 failed" in result.stdout, (
        f"The harness gave no report of the checks.\n\n{report}"
    )


def test_every_file_that_the_page_names_is_there():
    """One wrong letter in an address gives a page with no design, and no error."""
    named = LOCAL_ASSET.findall(PAGE.read_text(encoding="utf-8"))
    assert named, "The page names no local file. Read the pattern above."

    absent = [name for name in named if not (STATIC / name).is_file()]
    assert not absent, (
        "The page names a file that is not in `static/`. FastAPI answers 404 for "
        f"each one, and the browser reports nothing: {absent}"
    )


def test_every_stylesheet_is_on_the_page():
    """A stylesheet that the page does not name is a file that nobody reads."""
    named = set(LOCAL_ASSET.findall(PAGE.read_text(encoding="utf-8")))
    on_disk = {f"css/{path.name}" for path in (STATIC / "css").glob("*.css")}

    forgotten = sorted(on_disk - named)
    assert not forgotten, (
        "These stylesheets are in `static/css` and the page does not name them. "
        f"Add a link, or delete the file: {forgotten}"
    )


def test_the_page_keeps_the_stylesheets_in_the_order_of_the_numbers():
    """The order of the links is the cascade. The numbers are there to show it.

    The tokens must come first, because every file after them reads them, and the
    small screens and print must come last, because those rules must win. A link
    in the wrong place gives a page that is almost right, which is harder to see
    than a page that is plainly wrong.
    """
    linked = [
        name for name in LOCAL_ASSET.findall(PAGE.read_text(encoding="utf-8"))
        if name.startswith("css/")
    ]

    assert linked == sorted(linked), (
        "The page names the stylesheets out of the order of the numbers. The "
        f"page has {linked}, and the order must be {sorted(linked)}"
    )


# ---------------------------------------------------------------------------
# The stylesheets themselves.
#
# No test above this line reads one CSS declaration. They look at the name of
# each file, at the links on the page, and at the order of those links. So all
# of them pass when each of the sixteen files holds nothing at all. The tests
# below read the declarations. See `docs/VERIFICATION_LEDGER.md` row 5.6.
# ---------------------------------------------------------------------------

# The text inside each innermost pair of braces. A selector stays outside, and
# so does the condition of an `@media` rule. Thus an ID such as `#facts` cannot
# look like a colour to the group below.
DECLARATIONS = re.compile(r"\{([^{}]*)\}", re.DOTALL)

# A colour that starts with `#`. CSS takes 3, 4, 6, or 8 digits, and no other
# count. A count that is not in the list makes the whole declaration invalid.
HEX_COLOUR = re.compile(r"#([0-9A-Fa-f]+)\b")

# `--name:` gives a value to a custom property.
TOKEN_VALUE = re.compile(r"(--[A-Za-z0-9_-]+)\s*:")

# `var(--name)` reads one. The second group holds a comma when the use gives a
# fallback value. A token that has a fallback needs no value of its own.
TOKEN_READ = re.compile(r"var\(\s*(--[A-Za-z0-9_-]+)\s*(,?)")

# `index.html` gives `--i` a value in a `style` attribute, and no stylesheet
# does. The entrance stagger needs one number for each panel.
INLINE_TOKENS = frozenset({"--i"})

# Each character above ASCII that the design uses on purpose:
# `§` a rule, `…` a node at work, `◆` an agent node, `✓` a node that is done,
# `✕` a node that failed, `✗` an element that the repository does not have.
#
# Keep this list short. A character that is not here stops the tests, which
# gives a new glyph a look before it goes in. An emoji is never permitted.
APPROVED_GLYPHS = frozenset("§…◆✓✕✗")


def stylesheets() -> list[tuple[str, str]]:
    """Give the name and the text of each stylesheet, in the order of the names."""
    found = sorted((STATIC / "css").glob("*.css"))
    assert found, "There is no stylesheet in `static/css`."
    return [(path.name, path.read_text(encoding="utf-8")) for path in found]


def declarations_of(text: str) -> str:
    """Give only the declarations of a stylesheet, with no selector."""
    return "\n".join(DECLARATIONS.findall(text))


def test_every_token_that_a_stylesheet_reads_has_a_value():
    """A token with no value makes each declaration that reads it invalid.

    The browser reports nothing. It drops the declaration and takes the value
    that the element inherits, so the page keeps most of its design and loses
    one part of it. That is harder to see than a page with no design at all.
    """
    sheets = stylesheets()

    has_value = set(INLINE_TOKENS)
    for _, text in sheets:
        has_value.update(TOKEN_VALUE.findall(text))

    read_without_value = {}
    for name, text in sheets:
        for token, fallback in TOKEN_READ.findall(text):
            if not fallback and token not in has_value:
                read_without_value.setdefault(token, []).append(name)

    assert not read_without_value, (
        "These tokens are read and no file gives them a value. Give each one a "
        "value in `01-tokens.css`, or give the use a fallback: "
        f"{read_without_value}"
    )


def test_every_colour_in_a_stylesheet_is_a_colour():
    """A hex colour with the wrong count of digits is not a colour.

    A custom property takes any text, so `--paper-deep: #E5DCB` goes in without
    a word. The fault comes later, at each `var(--paper-deep)`, where the
    declaration becomes invalid and the browser drops it.
    """
    wrong = []
    for name, text in stylesheets():
        for digits in HEX_COLOUR.findall(declarations_of(text)):
            if len(digits) not in (3, 4, 6, 8):
                wrong.append(f"{name}: #{digits} has {len(digits)} digits")

    assert not wrong, (
        "CSS takes a hex colour of 3, 4, 6, or 8 digits, and no other count. "
        f"These are not colours: {wrong}"
    )


def test_the_braces_of_each_stylesheet_are_balanced():
    """One brace that is not closed takes the rest of the file with it."""
    unbalanced = []
    for name, text in stylesheets():
        body = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
        opened, closed = body.count("{"), body.count("}")
        if opened != closed:
            unbalanced.append(f"{name}: {opened} open, {closed} closed")

    assert not unbalanced, (
        "A stylesheet has a brace that is not closed. The browser drops each "
        f"rule after it and says nothing: {unbalanced}"
    )


def test_no_stylesheet_is_empty():
    """A file with no rule in it passes every test that only reads its name."""
    empty = [
        name for name, text in stylesheets()
        if not declarations_of(text).strip()
    ]
    assert not empty, f"These stylesheets hold no declaration: {empty}"


def test_no_stylesheet_holds_a_glyph_that_nobody_approved():
    """Hold the design to the glyphs it chose. An emoji is never permitted."""
    strange = {}
    for name, text in stylesheets():
        for character in text:
            if ord(character) > 127 and character not in APPROVED_GLYPHS:
                strange.setdefault(f"U+{ord(character):04X} {character}", []).append(name)

    assert not strange, (
        "These characters are above ASCII and are not in `APPROVED_GLYPHS`. An "
        "emoji must come out. A glyph that the design needs goes in the list, "
        f"with a word in the comment to say what it means: {strange}"
    )


# ---------------------------------------------------------------------------
# The two palettes.
#
# `tools/gen_m3_palette.py` writes `01-tokens.css`, and it writes three blocks
# of tokens: the light palette, the dark palette inside a media query, and the
# dark palette again for the toggle. Nothing above this line reads a value out
# of any of the three. So all of the tests above pass when the dark palette
# holds black text on a black card.
#
# The tests below measure the colours. They are here because the operator reads
# this page many times in one day, in the light of a morning and in the dark of
# a night, and a pair that fails is a pair that the operator cannot read.
# ---------------------------------------------------------------------------

TOKENS = STATIC / "css" / "01-tokens.css"

STAMP_JS = STATIC / "js" / "stamp.js"

# `--name: value;` inside one block of tokens.
TOKEN_PAIR = re.compile(r"(--[a-z0-9-]+)\s*:\s*([^;]+);")

# The three anchors that open the three blocks of tokens in `01-tokens.css`.
# The light palette comes first, because every rule reads it. The two dark
# blocks must hold the same values: one answers the choice of the system, and
# the other answers the choice of the operator.
LIGHT_BLOCK = ":root {"
DARK_TOGGLE_BLOCK = ':root[data-theme="dark"] {'
DARK_SYSTEM_BLOCK = ':root:not([data-theme="light"]) {'

# The limits of WCAG 2.1. Text takes 4.5:1 at the sizes that this page uses,
# and a graphic or the edge of a control takes 3.0:1.
#
# The list is by hand and it must stay by hand. A pair that is not here is a
# pair that nobody measured, so a new colour on a new fill goes in this list at
# the same time as it goes in the stylesheet.
TEXT_LIMIT = 4.5
GRAPHIC_LIMIT = 3.0

COLOUR_PAIRS = (
    # The three colours of the text ramp, on each fill that the design uses.
    ("--m3-on-surface", "--m3-surface", TEXT_LIMIT),
    ("--m3-on-surface-variant", "--m3-surface", TEXT_LIMIT),
    ("--m3-on-surface", "--m3-surface-container-lowest", TEXT_LIMIT),
    ("--m3-on-surface-variant", "--m3-surface-container-lowest", TEXT_LIMIT),
    ("--m3-on-surface", "--m3-surface-container-low", TEXT_LIMIT),
    ("--m3-on-surface-variant", "--m3-surface-container-low", TEXT_LIMIT),
    ("--m3-on-surface", "--m3-surface-container", TEXT_LIMIT),
    ("--m3-on-surface-variant", "--m3-surface-container", TEXT_LIMIT),
    ("--m3-on-surface", "--m3-surface-container-high", TEXT_LIMIT),
    ("--m3-on-surface-variant", "--m3-surface-container-high", TEXT_LIMIT),
    # The text of a link and of a button with no fill.
    ("--m3-primary", "--m3-surface", TEXT_LIMIT),
    ("--m3-primary", "--m3-surface-container-low", TEXT_LIMIT),
    ("--m3-primary", "--m3-surface-container", TEXT_LIMIT),
    # The words of a state: a fault, a warning, a result that is good.
    ("--m3-error", "--m3-surface-container-low", TEXT_LIMIT),
    ("--m3-error", "--m3-surface-container", TEXT_LIMIT),
    ("--m3-warning", "--m3-surface-container-low", TEXT_LIMIT),
    ("--m3-warning", "--m3-surface-container", TEXT_LIMIT),
    ("--m3-success", "--m3-surface-container-low", TEXT_LIMIT),
    ("--m3-success", "--m3-surface-container", TEXT_LIMIT),
    # The label on a fill of the same colour.
    ("--m3-on-primary", "--m3-primary", TEXT_LIMIT),
    ("--m3-on-error", "--m3-error", TEXT_LIMIT),
    ("--m3-on-success", "--m3-success", TEXT_LIMIT),
    ("--m3-on-primary-container", "--m3-primary-container", TEXT_LIMIT),
    ("--m3-on-secondary-container", "--m3-secondary-container", TEXT_LIMIT),
    ("--m3-on-error-container", "--m3-error-container", TEXT_LIMIT),
    ("--m3-on-success-container", "--m3-success-container", TEXT_LIMIT),
    ("--m3-on-warning-container", "--m3-warning-container", TEXT_LIMIT),
    # The slip. It turns the two colours over, so it needs its own measure.
    ("--m3-inverse-on-surface", "--m3-inverse-surface", TEXT_LIMIT),
    # The edges and the marks. A person must find these, and read no word in
    # them, so each one takes the lower limit.
    ("--m3-outline", "--m3-surface-container-lowest", GRAPHIC_LIMIT),
    ("--m3-outline", "--m3-surface-container-low", GRAPHIC_LIMIT),
    ("--m3-outline", "--m3-surface-container", GRAPHIC_LIMIT),
    ("--m3-primary", "--m3-surface-container-low", GRAPHIC_LIMIT),
    ("--m3-tertiary", "--m3-primary-container", GRAPHIC_LIMIT),
    ("--m3-success", "--m3-surface-container-low", GRAPHIC_LIMIT),
    ("--m3-warning", "--m3-surface-container-low", GRAPHIC_LIMIT),
)


def token_block(anchor: str) -> dict[str, str]:
    """Give each token of one block of `01-tokens.css`.

    The three blocks hold declarations and no nested rule, so the block ends at
    the first close brace after the anchor.
    """
    text = TOKENS.read_text(encoding="utf-8")
    assert anchor in text, (
        f"`01-tokens.css` holds no block that starts with `{anchor}`. "
        "`tools/gen_m3_palette.py` writes this file, so look at the generator "
        "and not at the stylesheet."
    )
    start = text.index(anchor) + len(anchor)
    end = text.index("}", start)
    found = dict(TOKEN_PAIR.findall(text[start:end]))
    assert found, f"The block `{anchor}` holds no token."
    return found


def channel(value: float) -> float:
    """Take one channel of sRGB back to light. The formula is in WCAG 2.1."""
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def luminance(colour: str) -> float:
    """Give the relative luminance of one hex colour, from 0 to 1."""
    digits = colour.strip().lstrip("#")
    assert len(digits) == 6, (
        f"This test measures a colour of six digits, and it got `{colour}`. A "
        "token that holds another form of colour needs a new branch here."
    )
    red, green, blue = (int(digits[at : at + 2], 16) / 255 for at in (0, 2, 4))
    return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)


def contrast(front: str, back: str) -> float:
    """Give the contrast of two colours, from 1.0 to 21.0."""
    one, two = luminance(front), luminance(back)
    high, low = max(one, two), min(one, two)
    return (high + 0.05) / (low + 0.05)


def test_the_two_dark_blocks_hold_the_same_values():
    """One dark palette answers the system, and the other answers the toggle.

    A person who chooses dark with the toggle must get the same page as a person
    whose system is dark. Two blocks that drift apart give two dark modes, and
    the fault shows only to the person who uses the toggle on a light system.
    """
    system = token_block(DARK_SYSTEM_BLOCK)
    toggle = token_block(DARK_TOGGLE_BLOCK)

    different = sorted(
        f"{name}: system has {system[name]}, toggle has {toggle[name]}"
        for name in system.keys() & toggle.keys()
        if system[name].strip() != toggle[name].strip()
    )
    only_system = sorted(system.keys() - toggle.keys())
    only_toggle = sorted(toggle.keys() - system.keys())

    assert not (different or only_system or only_toggle), (
        "The two dark palettes are not the same. `tools/gen_m3_palette.py` must "
        f"write one list of values two times.\nDifferent: {different}\n"
        f"Only in the media query: {only_system}\n"
        f"Only under the toggle: {only_toggle}"
    )


def test_every_colour_role_of_the_light_mode_is_in_the_dark_mode():
    """A role that the dark palette forgets keeps the value of the light one.

    Each dark block sits on `:root`, and it gives a new value to each token that
    it names. A token that it does not name keeps the light value, so one colour
    of the morning stays on a page that is dark everywhere else. The browser
    reports nothing, because a token with a value is not a fault.
    """
    light = token_block(LIGHT_BLOCK)
    dark = token_block(DARK_TOGGLE_BLOCK)

    forgotten = sorted(
        name for name in light
        if name.startswith("--m3-") and name not in dark
    )
    assert not forgotten, (
        "The dark palette does not name these colour roles, so each one keeps "
        f"its light value on a dark page: {forgotten}"
    )


def test_every_colour_pair_that_the_design_uses_passes_in_both_modes():
    """Measure the design, and do not trust the tone numbers of M3.

    Material 3 says that two tones with a distance of 40 or more give enough
    contrast. That is not true at each pair: tone 50 on tone 100 measures 4.46:1
    and the limit for text is 4.5:1. So this test reads the colours that the
    stylesheet holds and it measures each pair that the design puts together.

    The list is by hand. A pair that is not in `COLOUR_PAIRS` is a pair that
    nobody measured.
    """
    modes = (
        ("light", token_block(LIGHT_BLOCK)),
        ("dark", token_block(DARK_TOGGLE_BLOCK)),
    )

    absent = []
    failed = []
    for mode, palette in modes:
        for front, back, limit in COLOUR_PAIRS:
            if front not in palette or back not in palette:
                absent.append(f"{mode}: {front} on {back}")
                continue
            got = contrast(palette[front], palette[back])
            if got < limit:
                failed.append(
                    f"{mode}: {front} ({palette[front]}) on {back} "
                    f"({palette[back]}) gives {got:.2f}:1 and needs {limit}:1"
                )

    assert not absent, (
        "`COLOUR_PAIRS` names a token that the palette does not hold. Correct "
        f"the name, or take the pair out of the list: {absent}"
    )
    assert not failed, (
        "These pairs of colours are in the design and a person cannot read "
        f"them. Change the tone in `tools/gen_m3_palette.py`: {failed}"
    )


def test_every_state_of_the_stamp_has_a_rule():
    """The stamp shows the status of a row, and each status needs a tone.

    `js/stamp.js` writes the status into `data-verdict`. A status with no rule
    in `13-stamp.css` gives a badge with the plain fill, which says that the run
    is ordinary. A run that failed is not ordinary. The fault shows only on the
    row that holds the new status, and a run that goes well never shows it.
    """
    source = STAMP_JS.read_text(encoding="utf-8")
    start = source.index("const STAMP_TEXT = {")
    end = source.index("};", start)
    keys = re.findall(r"^\s*([A-Z][A-Z_]*)\s*:", source[start:end], re.MULTILINE)
    assert len(keys) >= 9, (
        "This test found fewer than nine states in `js/stamp.js`. Look at "
        f"`STAMP_TEXT` and at the pattern above: {keys}"
    )

    rules = (STATIC / "css" / "13-stamp.css").read_text(encoding="utf-8")
    without = [key for key in keys if f'[data-verdict="{key}"]' not in rules]
    assert not without, (
        "`js/stamp.js` writes these states and `13-stamp.css` holds no rule "
        "for them. Give each one a tone, or a rule that says in a comment why "
        f"it takes no colour: {without}"
    )

