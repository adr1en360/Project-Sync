"""Make the interface tokens, and then measure the contrast.

The palette holds standard colours. There are three groups:

  the neutrals    a true grey paper and a true grey ink, at one fixed hue;
  the signals     green for a pass, red for a failure, amber for a hold;
  the accent      one family that carries the brand colour.

Only the accent moves. The signal colours keep the meaning that a person expects:
a green mark is always green, and a red mark is always red. A palette of one hue
in many shades cannot do that, because it holds no green and no red.

The accent reads one custom property, `--h`, for its hue. It is a number with a
`@property` rule, and only that rule lets the browser move a custom property
smoothly. So a change of preset sweeps the accent from one colour to the next.

THE CHROMA OF THE ACCENT DOES NOT MOVE, AND THAT IS ON PURPOSE. The sRGB gamut is
not the same width at each hue. Two things follow from that fact, and the second
one is easy to miss:

  A hue in a narrow part of the gamut holds very little chroma. At a middle
  lightness a cyan near 195 degrees holds a chroma of only 0.085, while a blue
  near 260 degrees holds 0.204 and a violet near 280 degrees holds 0.289. So the
  presets must all sit in a wide part of the gamut, or the accent looks washed
  out. `report()` prints the measurement of the whole circle.

  The edge of the gamut curves. A straight line between two chromas that are both
  inside the gamut can still pass outside it, because the edge between the two
  hues bends in. So a chroma that moves with the hue is not safe, even when both
  of its ends are safe. An earlier form of this file moved the chroma with the
  hue and put 200 colours outside the gamut in the middle of a sweep.

So the chroma of each accent step is one number, and it is the smallest chroma
that the whole arc of the presets can hold. Each preset writes only the hue. Every
hue that a sweep can pass through is then inside the gamut by construction, and
the browser never has to map a colour that this program did not measure.

This file proves the contrast instead of trusting it:

  it fits the chroma of each colour into the sRGB gamut, and it holds the
  lightness, because the contrast depends on the lightness;
  it measures each pair that must pass a limit;
  it measures the accent at every hue of the arc, in steps of half a degree,
  because a sweep passes through all of them;
  it fails and writes nothing if one pair at one hue is below its limit.

The output goes to `web/src/styles/tokens.css`. Do not edit that file by hand.
`tests/test_design_tokens.py` compares the file with the output of this program,
so a hand edit makes the test suite fail.

This file is the only palette program. The old one, `tools/gen_m3_palette.py`,
went out with the `static/` folder that it wrote to. No token name is shared with
it, so nothing of the old palette can come back by accident.

Run:
    uv run python tools/gen_palette.py            # writes the report
    uv run python tools/gen_palette.py --write    # writes the CSS too
"""

from __future__ import annotations

import math
import sys
from functools import cache
from pathlib import Path

# --------------------------------------------------------------------------
# The hues
# --------------------------------------------------------------------------

# The neutrals sit at one fixed hue with almost no chroma, so they read as grey.
# 260 degrees makes a very slightly cool grey, and the small chroma keeps the grey
# from looking dead.
NEUTRAL_HUE = 260.0

# The signal colours. Each hue is the ordinary place of that colour, so a person
# reads the meaning without a legend.
SIGNAL_HUES: dict[str, tuple[float, str]] = {
    "pass": (150.0, "green, a step that finished and a rule that is on"),
    "fail": (27.0, "red, the gate that says no and every failed state"),
    "hold": (75.0, "amber, a partial result and a run that waits for a person"),
}

# The accent presets. Each preset is a pair of hues: one for light mode and one
# for dark mode. A hue that is correct on paper turns cold on a dark surface, so
# dark mode takes its own number.
#
# The three hues sit in one arc, from 258 to 336 degrees. Two rules made that
# choice:
#
#   The gamut must be wide at every hue of the arc. This arc holds a chroma of
#   0.150 or more at the lightness of the solid fill. The arc that an earlier
#   form of this file used went down to a teal at 195 degrees, where the gamut
#   holds only 0.085, and one narrow hue made all three presets pale.
#
#   The arc must hold no signal hue. The signals are at 27, 75 and 150 degrees,
#   and the arc is far from each of them. So a sweep can never make the accent
#   look like a signal, and the accent can never take the meaning of one.
PRESETS: tuple[tuple[str, float, float, str], ...] = (
    ("azure", 258.0, 262.0, "deep blue"),
    ("violet", 300.0, 303.0, "violet"),
    ("rose", 333.0, 336.0, "rose"),
)

DEFAULT_PRESET = "azure"

# The step of the sweep of the arc, in degrees. The fit of the chroma and the
# measurement of the contrast both use it.
HUE_STEP = 0.5

# --------------------------------------------------------------------------
# The neutral ramp
#
# A ramp entry gives the lightness and the chroma that the colour asks for. The
# program fits the chroma into the sRGB gamut and it keeps the lightness.
#
# Dark mode is not light mode turned over. It has its own lightness values, and
# `slab` becomes the lightest surface instead of the darkest. So dark mode reads
# as ink on a slab, and not as a negative of light mode. The names keep their
# meaning in both modes: `slab` is always the surface that inverts a row.
# --------------------------------------------------------------------------

NEUTRAL_LIGHT: dict[str, tuple[float, float]] = {
    # name             lightness  chroma
    "paper": (0.988, 0.002),
    "paper-raised": (0.996, 0.001),
    "paper-sunken": (0.960, 0.003),
    "paper-edge": (0.905, 0.004),
    "ink": (0.250, 0.005),
    "ink-quiet": (0.470, 0.005),
    "ink-faint": (0.620, 0.005),
    "slab": (0.210, 0.006),
    "ink-inverse": (0.980, 0.002),
}

NEUTRAL_DARK: dict[str, tuple[float, float]] = {
    "paper": (0.175, 0.006),
    "paper-raised": (0.215, 0.007),
    "paper-sunken": (0.145, 0.005),
    "paper-edge": (0.315, 0.008),
    "ink": (0.945, 0.004),
    "ink-quiet": (0.760, 0.006),
    "ink-faint": (0.615, 0.008),
    "slab": (0.965, 0.003),
    "ink-inverse": (0.200, 0.006),
}

# --------------------------------------------------------------------------
# The steps of a colour family
#
# The accent and each signal colour get the same steps, so a component uses one
# pattern for all of them:
#
#   `--pass`         the solid fill, and the colour of a mark on paper
#   `--pass-strong`  the fill under a pointer or a press
#   `--pass-wash`    a quiet tinted surface, for a badge or a row
#   `--pass-ink`     the text on that tinted surface
#   `--on-pass`      the text on the solid fill
#
# The chroma of each step is what the step asks for. The fit makes it smaller when
# the hue cannot hold that much. A signal colour has one hue, so its fit is at
# that hue. The accent moves, so its fit is the smallest value of the whole arc.
# --------------------------------------------------------------------------

FAMILY_LIGHT: tuple[tuple[str, float, float], ...] = (
    ("", 0.500, 0.150),
    ("-strong", 0.420, 0.160),
    ("-wash", 0.950, 0.045),
    ("-ink", 0.390, 0.130),
)

FAMILY_DARK: tuple[tuple[str, float, float], ...] = (
    ("", 0.680, 0.140),
    ("-strong", 0.760, 0.130),
    ("-wash", 0.270, 0.055),
    ("-ink", 0.825, 0.110),
)

# The text that sits on a solid fill. It is a neutral, so it is the same on every
# family and it takes the neutral hue.
ON_FILL_LIGHT = (0.985, 0.004)
ON_FILL_DARK = (0.180, 0.006)

MODES = ("light", "dark")
NEUTRALS = {"light": NEUTRAL_LIGHT, "dark": NEUTRAL_DARK}
STEPS = {"light": FAMILY_LIGHT, "dark": FAMILY_DARK}
ON_FILL = {"light": ON_FILL_LIGHT, "dark": ON_FILL_DARK}

# The contrast limits of WCAG 2.2 at level AA.
#
# 4.5 is for text that is smaller than 24px, or smaller than 18.66px bold.
# 3.0 is for larger text, and WCAG 1.4.11 asks the same 3.0 for the edge of a
# control and for a graphic that carries meaning.
TEXT_LIMIT = 4.5
GRAPHIC_LIMIT = 3.0

# Each neutral pair that must pass a limit.
#
# `ink` and `ink-quiet` carry text, so they take the text limit on each surface
# that they sit on. `ink-faint` takes the graphic limit, and the rule of its use
# follows from that number: a large heading, a hairline that carries meaning, the
# edge of a control, and no small text. `paper-edge` carries no meaning and is not
# here, because it only draws the quiet line between two cards.
NEUTRAL_PAIRS: tuple[tuple[str, str, float], ...] = (
    ("ink", "paper", TEXT_LIMIT),
    ("ink", "paper-raised", TEXT_LIMIT),
    ("ink", "paper-sunken", TEXT_LIMIT),
    ("ink-quiet", "paper", TEXT_LIMIT),
    ("ink-quiet", "paper-raised", TEXT_LIMIT),
    ("ink-quiet", "paper-sunken", TEXT_LIMIT),
    ("ink-inverse", "slab", TEXT_LIMIT),
    ("ink-faint", "paper", GRAPHIC_LIMIT),
    ("ink-faint", "paper-raised", GRAPHIC_LIMIT),
    ("ink-faint", "paper-sunken", GRAPHIC_LIMIT),
    ("slab", "paper", GRAPHIC_LIMIT),
    ("slab", "paper-raised", GRAPHIC_LIMIT),
)

# Each pair of a colour family, written one time and used for every family.
#
# A wash is a surface and it is not a graphic, so it has no limit against the
# paper. Two adjacent surfaces need no contrast ratio. A badge on a wash must
# still have a visible edge, and the last pair is that edge: a component draws the
# border of a badge in `--{name}`, and that border must reach 3.0 against the wash
# that it holds.
FAMILY_PAIRS: tuple[tuple[str, str, float], ...] = (
    ("on-{name}", "{name}", TEXT_LIMIT),
    ("{name}-ink", "{name}-wash", TEXT_LIMIT),
    ("{name}", "paper", TEXT_LIMIT),
    ("{name}", "paper-raised", TEXT_LIMIT),
    ("{name}", "paper-sunken", GRAPHIC_LIMIT),
    ("{name}-strong", "paper", TEXT_LIMIT),
    ("{name}", "{name}-wash", GRAPHIC_LIMIT),
)

# --------------------------------------------------------------------------
# Colour conversion
#
# The CSS says `oklch()`, so the measurement must use the same space. Oklab is not
# CIELAB and it has its own matrices. The steps are:
#
#   OkLCh -> Oklab -> long, medium and short cone response -> linear sRGB
#
# The numbers come from the definition of Oklab by Bjoern Ottosson.
# --------------------------------------------------------------------------

Triple = tuple[float, float, float]
"""One colour, as the lightness, the chroma and the hue."""


def _to_srgb(channel: float) -> float:
    """Take one linear channel and give the sRGB value from 0 to 1."""
    if channel <= 0.0031308:
        return channel * 12.92
    return 1.055 * (channel ** (1 / 2.4)) - 0.055


def oklch_to_linear(lightness: float, chroma: float, hue: float) -> Triple:
    """Give the three linear sRGB channels of one OkLCh colour.

    A channel can go outside 0 to 1. That result means that the colour is outside
    the sRGB gamut, and `in_gamut` finds it.
    """
    radians = math.radians(hue)
    a = chroma * math.cos(radians)
    b = chroma * math.sin(radians)

    long_ = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
    medium = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
    short = (lightness - 0.0894841775 * a - 1.2914855480 * b) ** 3

    red = 4.0767416621 * long_ - 3.3077115913 * medium + 0.2309699292 * short
    green = -1.2684380046 * long_ + 2.6097574011 * medium - 0.3413193965 * short
    blue = -0.0041960863 * long_ - 0.7034186147 * medium + 1.7076147010 * short
    return red, green, blue


def in_gamut(lightness: float, chroma: float, hue: float) -> bool:
    """Tell if one OkLCh colour is inside sRGB.

    The margin holds the error of the floating point arithmetic only. It is not a
    permission to go outside the gamut.
    """
    return all(-0.0005 <= _to_srgb(c) <= 1.0005 for c in oklch_to_linear(lightness, chroma, hue))


# The result depends on the three arguments only, so a cache is safe. The fit runs
# many thousand times, because the measurement sweeps the whole arc.
@cache
def fit_chroma(lightness: float, chroma: float, hue: float) -> float:
    """Give the largest chroma at or below `chroma` that stays inside sRGB.

    A high chroma at a very light or a very dark lightness falls outside the
    gamut. The browser would then map the colour to another one, and the mapped
    colour has a luminance that this program did not measure. So the program makes
    the chroma smaller instead. The lightness does not change, because the
    contrast depends on it.

    24 steps of bisection give a chroma that is correct to 7 decimal places.
    """
    if in_gamut(lightness, chroma, hue):
        return chroma

    low, high = 0.0, chroma
    for _ in range(24):
        middle = (low + high) / 2
        if in_gamut(lightness, middle, hue):
            low = middle
        else:
            high = middle
    return low


def relative_luminance(lightness: float, chroma: float, hue: float) -> float:
    """Give the relative luminance of one OkLCh colour, as WCAG 2.x defines it.

    WCAG asks for the luminance of the linear sRGB channels. The conversion above
    already gives linear channels, so no reverse gamma step is necessary. A
    channel is held inside 0 to 1, because a display cannot show more.
    """
    red, green, blue = (max(0.0, min(1.0, c)) for c in oklch_to_linear(lightness, chroma, hue))
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue


def contrast(first: Triple, second: Triple) -> float:
    """Give the contrast ratio of two colours, from 1 to 21."""
    light, dark = sorted(
        (relative_luminance(*first), relative_luminance(*second)), reverse=True
    )
    return (light + 0.05) / (dark + 0.05)


# --------------------------------------------------------------------------
# The arc of the accent
# --------------------------------------------------------------------------


def family_names() -> tuple[str, ...]:
    """Give the name of each colour family, the accent first."""
    return ("accent", *SIGNAL_HUES)


def step_names() -> tuple[str, ...]:
    """Give the suffix of each step of a family, such as `-wash`."""
    return tuple(suffix for suffix, _, _ in FAMILY_LIGHT)


def preset_hue(name: str, mode: str) -> float:
    """Give the hue of one preset in one mode."""
    for preset, light_hue, dark_hue, _ in PRESETS:
        if preset == name:
            return light_hue if mode == "light" else dark_hue
    raise KeyError(name)


def arc() -> tuple[float, float]:
    """Give the lowest and the highest hue that the accent can take.

    The arc holds the hue of each preset in each mode. The browser moves `--h`
    from one number to another one along a straight line, so a sweep between any
    two presets stays inside these two numbers.
    """
    hues = [hue for _, light, dark, _ in PRESETS for hue in (light, dark)]
    return min(hues), max(hues)


def arc_hues() -> list[float]:
    """Give each hue of the arc that the measurement uses.

    The two ends and the hue of each preset are always in the list, so a preset
    that never changes is measured too.
    """
    low, high = arc()
    count = int((high - low) / HUE_STEP) + 1
    hues = [low + index * HUE_STEP for index in range(count)]
    hues += [high]
    hues += [preset_hue(name, mode) for name, _, _, _ in PRESETS for mode in MODES]
    return sorted(set(hues))


def accent_chroma(mode: str) -> dict[str, float]:
    """Give the chroma of each accent step, as one number for the whole arc.

    The number is the smallest chroma that the arc can hold at the lightness of
    that step. So the chroma is safe at every hue of the arc, and it does not have
    to move when the hue moves. The key is the suffix of the step, and the empty
    key is the solid fill.
    """
    return {
        suffix: min(fit_chroma(li, ch, hue) for hue in arc_hues())
        for suffix, li, ch in STEPS[mode]
    }


def palette(mode: str, hue: float) -> dict[str, Triple]:
    """Give every colour of one mode, with the accent at one hue."""
    out: dict[str, Triple] = {}

    for name, (li, ch) in NEUTRALS[mode].items():
        out[name] = (li, fit_chroma(li, ch, NEUTRAL_HUE), NEUTRAL_HUE)

    on_li, on_ch = ON_FILL[mode]
    on_fill = (on_li, fit_chroma(on_li, on_ch, NEUTRAL_HUE), NEUTRAL_HUE)

    chroma = accent_chroma(mode)
    for suffix, li, _ in STEPS[mode]:
        out["accent" + suffix] = (li, chroma[suffix], hue)
    out["on-accent"] = on_fill

    for signal, (signal_hue, _) in SIGNAL_HUES.items():
        for suffix, li, ch in STEPS[mode]:
            out[signal + suffix] = (li, fit_chroma(li, ch, signal_hue), signal_hue)
        out["on-" + signal] = on_fill

    return out


def pairs() -> tuple[tuple[str, str, float], ...]:
    """Give every pair that must pass a limit, for the neutrals and the families."""
    out = list(NEUTRAL_PAIRS)
    for name in family_names():
        for front, back, limit in FAMILY_PAIRS:
            out.append((front.format(name=name), back.format(name=name), limit))
    return tuple(out)


def worst(mode: str) -> list[tuple[str, str, float, float, float]]:
    """Measure each pair of one mode at every hue of the arc.

    Give one row for each pair: the two names, the limit, the lowest ratio, and
    the hue where that lowest ratio is.
    """
    every = [(hue, palette(mode, hue)) for hue in arc_hues()]
    rows = []
    for front, back, limit in pairs():
        lowest, at = 99.0, 0.0
        for hue, colours in every:
            ratio = contrast(colours[front], colours[back])
            if ratio < lowest:
                lowest, at = ratio, hue
        rows.append((front, back, limit, lowest, at))
    return rows


def gamut_failures() -> list[tuple[str, str, float]]:
    """Give each colour that still falls outside sRGB, at any hue of the arc."""
    bad = []
    for mode in MODES:
        for hue in arc_hues():
            for name, (li, ch, colour_hue) in palette(mode, hue).items():
                if not in_gamut(li, ch, colour_hue):
                    bad.append((mode, name, hue))
    return bad


def report() -> int:
    """Print the measurement. Give the count of the tests that fail."""
    bad = 0
    all_pairs = pairs()
    low, high = arc()

    print("The interface palette, measured with the WCAG formula.")
    print(f"  {len(all_pairs)} pairs, {len(MODES)} modes, {len(arc_hues())} hues of the arc.")
    print(f"  Families: {', '.join(family_names())}.")
    print(f"  The arc of the accent: {low:.0f} to {high:.0f} degrees.")

    outside = gamut_failures()
    if outside:
        bad += len(outside)
        print(f"\n  GAMUT: {len(outside)} colours fall outside sRGB.")
        for mode, name, hue in outside[:10]:
            print(f"    FAIL  {mode} --{name} at hue {hue:.1f}")
    else:
        print("\n  GAMUT: every colour is inside sRGB at every hue of the arc.")

    print("\n  THE CHROMA OF THE ACCENT. One number for the whole arc.")
    for mode in MODES:
        chroma = accent_chroma(mode)
        for suffix, li, want in STEPS[mode]:
            got = chroma[suffix]
            note = "" if got >= want - 1e-9 else "  (the arc holds no more)"
            step = suffix or " (fill)"
            print(
                f"    {mode:<5} --accent{step:<8} L {li:.3f}"
                f"  asked {want:.3f}  got {got:.4f}{note}"
            )

    print("\n  THE GAMUT ACROSS THE WHOLE CIRCLE, at the lightness of the fill.")
    print("  This is why the presets sit where they do.")
    for mode in MODES:
        li = STEPS[mode][0][1]
        row = []
        for hue in range(0, 360, 30):
            row.append(f"{hue}:{fit_chroma(li, 0.40, hue):.2f}")
        cells = "  ".join(row)
        print(f"    {mode:<5} L {li:.2f}  {cells}")

    for mode in MODES:
        print(f"\n  {mode.upper()} MODE, the lowest ratio of every hue of the arc")
        for front, back, limit, lowest, at in worst(mode):
            ok = lowest >= limit
            if not ok:
                bad += 1
            mark = "PASS" if ok else "FAIL"
            print(
                f"    {mark}  {lowest:5.2f}:1  (needs {limit})"
                f"  --{front} on --{back}, worst at hue {at:.1f}"
            )

    total = len(all_pairs) * len(MODES)
    print(f"\n  {total} measurements, {bad} below the limit.")
    return bad


# --------------------------------------------------------------------------
# The stylesheet
# --------------------------------------------------------------------------


def _colour_css(name: str, colour: Triple) -> str:
    """Give the `oklch()` text of one colour.

    An accent step reads its hue from `--h`, so the browser can move it. Its
    chroma is a number, because one number is safe at every hue of the arc.
    """
    lightness, chroma, hue = colour
    if name.startswith("accent"):
        return f"oklch({lightness:.3f} {chroma:.4f} var(--h))"
    return f"oklch({lightness:.3f} {chroma:.4f} {hue:.0f})"


def _colour_lines(mode: str, indent: str) -> list[str]:
    """Give one `--name: oklch(...)` line for each colour of one mode."""
    colours = palette(mode, preset_hue(DEFAULT_PRESET, mode))
    width = max(len(name) for name in colours) + 3
    return [
        "{}{} {};".format(indent, (f"--{name}:").ljust(width), _colour_css(name, colour))
        for name, colour in colours.items()
    ]


def css() -> str:
    """Give the text of the token stylesheet."""
    signals = ", ".join(f"{name} {hue:.0f}" for name, (hue, _) in SIGNAL_HUES.items())
    low, high = arc()

    lines = [
        "/*",
        "  The interface tokens: the colours, the type scale, the spacing grid, the",
        "  shape scale, and the motion curves.",
        "",
        "  THIS FILE IS MADE BY A PROGRAM. Do not edit it by hand.",
        "  Run `uv run python tools/gen_palette.py --write` to make it again.",
        "  `tests/test_design_tokens.py` compares this file with the output of that",
        "  program, so a hand edit makes the test suite fail.",
        "",
        "  There are three groups of colour. The neutrals are a true grey paper and a",
        "  true grey ink. The signal colours are the ordinary ones, so a person reads",
        f"  the meaning without a legend ({signals} degrees). The accent carries the",
        "  brand colour, and it is the only group that moves.",
        "",
        "  An accent step reads `--h` for its hue. `--h` is a number with a",
        "  `@property` rule, and only that rule lets the browser move a custom",
        "  property smoothly. A preset writes `--h` and nothing else.",
        "",
        "  The chroma of the accent is a number and it does not move. The edge of the",
        "  sRGB gamut curves, so a straight line between two chromas that are both",
        "  inside it can pass outside it. The number here is the smallest chroma of",
        f"  the whole arc from {low:.0f} to {high:.0f} degrees, so it is safe at every hue that a",
        "  sweep passes through.",
        "",
        "  Each colour has its chroma fitted into the gamut at a fixed lightness, so",
        "  the browser never has to map a colour that the program did not measure.",
        "  Each pair of a text colour and its surface is measured with the WCAG",
        "  formula, at every half degree of the arc. Text is at 4.5:1 or more, and a",
        "  graphic that carries meaning is at 3.0:1 or more. The program writes",
        "  nothing if one pair at one hue is below its limit, so this file cannot hold",
        "  a pair that does not pass.",
        "*/",
        "",
        "/*",
        "  The hue of the accent. A custom property with no `@property` rule is a",
        "  string to the browser, and a string cannot be interpolated. This rule makes",
        "  the hue animatable.",
        "*/",
        "@property --h {",
        '  syntax: "<number>";',
        "  inherits: true;",
        "  initial-value: {:.0f};".format(preset_hue(DEFAULT_PRESET, "light")),
        "}",
        "",
        ":root {",
        "  color-scheme: light dark;",
        "",
        f"  /* The accent hue. Preset {DEFAULT_PRESET}, light mode. */",
        "  --h: {:.0f};".format(preset_hue(DEFAULT_PRESET, "light")),
        "",
        "  /* ---- The colours, light mode ---- */",
    ]
    lines += _colour_lines("light", "  ")

    lines += [
        "",
        "  /* ---- The three type families. The build carries the font files. ---- */",
        '  --font-serif: "Instrument Serif", "Iowan Old Style", Georgia, serif;',
        '  --font-sans: "Geist Sans", system-ui, -apple-system, "Segoe UI", sans-serif;',
        '  --font-mono: "Geist Mono", ui-monospace, SFMono-Regular, Consolas, monospace;',
        "",
        "  /* ---- The type scale. The body step is 15px at the browser default. ---- */",
        "  --step--1: 0.8125rem;",
        "  --step-0:  0.9375rem;",
        "  --step-1:  1.125rem;",
        "  --step-2:  1.5rem;",
        "  --step-3:  2rem;",
        "  --step-4:  2.75rem;",
        "  --step-5:  3.75rem;",
        "",
        "  /* ---- The line height and the tracking ---- */",
        "  --lh-tight: 1.1;",
        "  --lh-snug:  1.35;",
        "  --lh-body:  1.6;",
        "  --track-display: -0.02em;",
        "  --track-tight:   -0.01em;",
        "  --track-caps:     0.05em;",
        "",
        "  /* ---- The spacing grid. Every step is a multiple of 4px. ---- */",
        "  --sp-1:   4px;",
        "  --sp-2:   8px;",
        "  --sp-3:  12px;",
        "  --sp-4:  16px;",
        "  --sp-5:  20px;",
        "  --sp-6:  24px;",
        "  --sp-8:  32px;",
        "  --sp-10: 40px;",
        "  --sp-12: 48px;",
        "  --sp-16: 64px;",
        "",
        "  /* ---- The shape scale. A card takes md or lg, a button takes sm. ---- */",
        "  --r-sm:   4px;",
        "  --r-md:   8px;",
        "  --r-lg:  12px;",
        "  --r-pill: 9999px;",
        "  --rule:   1px;",
        "",
        "  /* ---- Motion ---- */",
        "  --ease-out:    cubic-bezier(0.16, 1, 0.3, 1);",
        "  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);",
        "  --dur-fast: 140ms;",
        "  --dur-base: 240ms;",
        "  --dur-slow: 600ms;",
        "  --dur-hue:  700ms;",
        "",
        "  /* ---- The smallest side of a target that a finger must hit ---- */",
        "  --target-min: 44px;",
        "}",
        "",
        "/*",
        "  The other accent presets, light mode. A preset writes one number. The",
        "  signal colours and the neutrals do not move.",
        "*/",
    ]

    for preset, light_hue, _, looks in PRESETS:
        if preset == DEFAULT_PRESET:
            continue
        lines += [
            f"/* {preset}: {looks} */",
            f':root[data-hue="{preset}"] {{ --h: {light_hue:.0f}; }}',
        ]

    lines += [
        "",
        "/*",
        "  Dark mode.",
        "",
        "  The wish of the machine comes first, and the choice of the person comes",
        "  after it. So a person who selects light mode gets light mode on a machine",
        "  that asks for dark mode, and the reverse.",
        "",
        "  Dark mode has its own lightness values, and its own hue for each preset. A",
        "  hue that is correct on paper turns cold on a dark surface. `slab` is the",
        "  lightest surface here, and it is the darkest surface in light mode. The",
        "  names keep their meaning: `slab` is always the surface that inverts a row.",
        "*/",
        "@media (prefers-color-scheme: dark) {",
        '  :root:not([data-theme="light"]) {',
        f"    /* Preset {DEFAULT_PRESET}, dark mode. */",
        "    --h: {:.0f};".format(preset_hue(DEFAULT_PRESET, "dark")),
        "",
    ]
    lines += _colour_lines("dark", "    ")
    lines += ["  }"]

    for preset, _, dark_hue, _ in PRESETS:
        if preset == DEFAULT_PRESET:
            continue
        lines += [
            f'  :root:not([data-theme="light"])[data-hue="{preset}"] {{ --h: {dark_hue:.0f}; }}'
        ]

    lines += [
        "}",
        "",
        "/* The person selected dark mode. */",
        ':root[data-theme="dark"] {',
        "  --h: {:.0f};".format(preset_hue(DEFAULT_PRESET, "dark")),
        "",
    ]
    lines += _colour_lines("dark", "  ")
    lines += ["}"]

    for preset, _, dark_hue, _ in PRESETS:
        if preset == DEFAULT_PRESET:
            continue
        lines += [
            f':root[data-theme="dark"][data-hue="{preset}"] {{ --h: {dark_hue:.0f}; }}'
        ]

    lines += [""]
    return "\n".join(lines)


def target_path() -> Path:
    """Give the path of the stylesheet that this program writes."""
    return Path(__file__).parent.parent / "web" / "src" / "styles" / "tokens.css"


def main() -> int:
    bad = report()

    if bad:
        print("\n  The palette is not written. Fix the ramp above first.")
        return 1

    if "--write" in sys.argv:
        target = target_path()
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(css(), encoding="utf-8", newline="\n")
        print(f"\n  Written: {target}")
    else:
        print("\n  Add `--write` to write `web/src/styles/tokens.css`.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())