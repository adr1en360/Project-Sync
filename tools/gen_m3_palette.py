"""Make the Material Design 3 tonal palettes, and then measure the contrast.

Material You builds its colours from a seed. It makes five tonal palettes, and
each palette holds 13 steps. A step is a `Tone`, from 0 (black) to 100 (white).
A semantic role, such as `--m3-primary`, points to one tone of one palette.

Google does this work in HCT. HCT joins CAM16 for the hue and the chroma with
CIELAB `L*` for the tone. This file uses CIELAB `LCh` instead, because CIELAB is
short to write and it needs no other package. The tone of this file is the same
`L*` that HCT uses, so the tones are correct. The chroma is an approximation.

The approximation is safe, for one reason: **this file measures the contrast of
each pair with the WCAG formula.** Material You says that a tonal difference of
50 or more gives WCAG AA. This file does not trust that statement. It measures
each pair and it fails if one pair is below the limit. So an error in the chroma
can make a colour less attractive, and it cannot make a colour fail AA.

The output goes to `static/css/01-tokens.css`. The browser reads that file
directly, so the product keeps no build step. Run this file again only when the
seed colour changes.

Run:
    uv run python tools/gen_m3_palette.py            # writes the report
    uv run python tools/gen_m3_palette.py --write    # writes the CSS too
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

# --------------------------------------------------------------------------
# The seeds
#
# The four signal colours of the product become four M3 roles. The product had
# these colours before Material You, and they keep their meaning:
#
#   stampblue  -> primary    a proposal that waits for a person
#   verdigris  -> success    a pass, an approval, an active rule
#   vermilion  -> error      the gate that says no, every correction mark
#   amber      -> warning    a partial result
#
# M3 gives a role for the error and no role for the success or the warning. So
# this file makes a full tonal palette for each of the three, and the CSS gets
# the roles that M3 does not supply.
# --------------------------------------------------------------------------

SEED_PRIMARY = "#1F476E"  # stampblue
SEED_SUCCESS = "#246045"  # verdigris
SEED_ERROR = "#B52B18"  # vermilion
SEED_WARNING = "#936A16"  # amber

# The chroma of each palette. These are the values of the M3 `TonalSpot` scheme,
# which is the default scheme of Material You.
CHROMA = {
    "primary": 36.0,
    "secondary": 16.0,
    "tertiary": 24.0,
    "neutral": 6.0,
    "neutral-variant": 8.0,
}

# The tertiary palette turns the hue of the seed by 60 degrees.
TERTIARY_HUE_SHIFT = 60.0

TONES = (
    0, 4, 6, 10, 12, 17, 20, 22, 24, 30, 40, 50, 60, 70, 80, 87, 90, 92, 94, 95, 96, 98, 99, 100
)
"""Each tone that a role below asks for.

M3 names 13 standard tones. The surface container roles of M3 need more, so this
list also holds the tones that those roles use, such as 4, 6, 12, and 87.
"""

# The white point of D65, which sRGB uses.
WHITE_X, WHITE_Y, WHITE_Z = 0.95047, 1.00000, 1.08883


# --------------------------------------------------------------------------
# Colour conversion
# --------------------------------------------------------------------------


def _to_linear(channel: float) -> float:
    """Take one sRGB channel from 0-1 and give the linear value."""
    if channel <= 0.04045:
        return channel / 12.92
    return ((channel + 0.055) / 1.055) ** 2.4


def _to_srgb(channel: float) -> float:
    """Take one linear channel and give the sRGB value from 0-1."""
    if channel <= 0.0031308:
        return channel * 12.92
    return 1.055 * (channel ** (1 / 2.4)) - 0.055


def hex_to_rgb(value: str) -> tuple[float, float, float]:
    """Take `#RRGGBB` and give the three channels from 0-1."""
    text = value.lstrip("#")
    return tuple(int(text[i : i + 2], 16) / 255 for i in (0, 2, 4))  # type: ignore[return-value]


def relative_luminance(value: str) -> float:
    """Give the relative luminance of a colour, as WCAG 2.x defines it.

    This is the `Y` of the CIE XYZ space. The contrast formula needs it.
    """
    red, green, blue = (_to_linear(c) for c in hex_to_rgb(value))
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue


def contrast(first: str, second: str) -> float:
    """Give the contrast ratio of two colours. The result is from 1 to 21."""
    light, dark = sorted((relative_luminance(first), relative_luminance(second)), reverse=True)
    return (light + 0.05) / (dark + 0.05)


def _f(ratio: float) -> float:
    """The helper function of the CIELAB transform."""
    if ratio > (6 / 29) ** 3:
        return ratio ** (1 / 3)
    return (1 / 3) * (29 / 6) ** 2 * ratio + 4 / 29


def _f_inverse(value: float) -> float:
    """The reverse of `_f`."""
    if value > 6 / 29:
        return value**3
    return 3 * (6 / 29) ** 2 * (value - 4 / 29)


def hex_to_lch(value: str) -> tuple[float, float, float]:
    """Take `#RRGGBB` and give the lightness, the chroma, and the hue.

    The hue is in degrees.
    """
    red, green, blue = (_to_linear(c) for c in hex_to_rgb(value))
    x = 0.4124564 * red + 0.3575761 * green + 0.1804375 * blue
    y = 0.2126729 * red + 0.7151522 * green + 0.0721750 * blue
    z = 0.0193339 * red + 0.1191920 * green + 0.9503041 * blue

    fx, fy, fz = _f(x / WHITE_X), _f(y / WHITE_Y), _f(z / WHITE_Z)
    lightness = 116 * fy - 16
    a = 500 * (fx - fy)
    b = 200 * (fy - fz)

    chroma = math.hypot(a, b)
    hue = math.degrees(math.atan2(b, a)) % 360
    return lightness, chroma, hue


def lch_to_rgb(lightness: float, chroma: float, hue: float) -> tuple[float, float, float]:
    """Give the three sRGB channels of one LCh colour. The channels can go out of 0-1."""
    radians = math.radians(hue)
    a = chroma * math.cos(radians)
    b = chroma * math.sin(radians)

    fy = (lightness + 16) / 116
    fx = fy + a / 500
    fz = fy - b / 200

    x = WHITE_X * _f_inverse(fx)
    y = WHITE_Y * _f_inverse(fy)
    z = WHITE_Z * _f_inverse(fz)

    red = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z
    green = -0.9692660 * x + 1.8760108 * y + 0.0415560 * z
    blue = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z
    return _to_srgb(red), _to_srgb(green), _to_srgb(blue)


def tone_to_hex(tone: float, chroma: float, hue: float) -> str:
    """Give the hex colour of one tone, and keep the colour inside sRGB.

    A high chroma at a very light or a very dark tone goes out of the sRGB gamut.
    The tone must not change, because the contrast depends on it. So this
    function keeps the tone and the hue, and it makes the chroma smaller until
    the colour is inside the gamut.
    """
    if tone <= 0:
        return "#000000"
    if tone >= 100:
        return "#FFFFFF"

    low, high = 0.0, chroma
    best = lch_to_rgb(tone, 0.0, hue)

    # 24 steps of bisection give a chroma that is correct to 7 decimal places.
    for _ in range(24):
        middle = (low + high) / 2
        candidate = lch_to_rgb(tone, middle, hue)
        if all(-0.0001 <= c <= 1.0001 for c in candidate):
            best, low = candidate, middle
        else:
            high = middle

    return "#" + "".join(f"{round(max(0.0, min(1.0, c)) * 255):02X}" for c in best)


def palette(seed: str, chroma: float, hue_shift: float = 0.0) -> dict[int, str]:
    """Give one tonal palette: each tone of the list, in the hue of the seed."""
    _, _, hue = hex_to_lch(seed)
    return {tone: tone_to_hex(tone, chroma, (hue + hue_shift) % 360) for tone in TONES}


# --------------------------------------------------------------------------
# The semantic roles
#
# A role is a pair: the palette and the tone. M3 fixes these numbers. The light
# column and the dark column come from the M3 specification, and section 3 of
# the Material You architecture note gives the same numbers.
# --------------------------------------------------------------------------

ROLES: tuple[tuple[str, str, int, int], ...] = (
    # (role name,                    palette,           light tone, dark tone)
    ("primary", "primary", 40, 80),
    ("on-primary", "primary", 100, 20),
    ("primary-container", "primary", 90, 30),
    ("on-primary-container", "primary", 10, 90),
    ("secondary", "secondary", 40, 80),
    ("on-secondary", "secondary", 100, 20),
    ("secondary-container", "secondary", 90, 30),
    ("on-secondary-container", "secondary", 10, 90),
    ("tertiary", "tertiary", 40, 80),
    ("on-tertiary", "tertiary", 100, 20),
    ("tertiary-container", "tertiary", 90, 30),
    ("on-tertiary-container", "tertiary", 10, 90),
    ("error", "error", 40, 80),
    ("on-error", "error", 100, 20),
    ("error-container", "error", 90, 30),
    ("on-error-container", "error", 10, 90),
    ("success", "success", 40, 80),
    ("on-success", "success", 100, 20),
    ("success-container", "success", 90, 30),
    ("on-success-container", "success", 10, 90),
    ("warning", "warning", 40, 80),
    ("on-warning", "warning", 100, 20),
    ("warning-container", "warning", 90, 30),
    ("on-warning-container", "warning", 10, 90),
    ("surface", "neutral", 98, 6),
    ("on-surface", "neutral", 10, 90),
    ("on-surface-variant", "neutral-variant", 30, 80),
    ("surface-dim", "neutral", 87, 6),
    ("surface-bright", "neutral", 98, 24),
    ("surface-container-lowest", "neutral", 100, 4),
    ("surface-container-low", "neutral", 96, 10),
    ("surface-container", "neutral", 94, 12),
    ("surface-container-high", "neutral", 92, 17),
    ("surface-container-highest", "neutral", 90, 22),
    ("inverse-surface", "neutral", 20, 90),
    ("inverse-on-surface", "neutral", 95, 20),
    ("outline", "neutral-variant", 50, 60),
    ("outline-variant", "neutral-variant", 80, 30),
)

# Each pair that must pass a contrast limit, and the limit.
#
# 4.5 is the AA limit for the text that is smaller than 18.66px bold or 24px.
# 3.0 is the AA limit for large text, and it is also the limit of WCAG 1.4.11
# for the boundary of a control and for a graphic that carries meaning.
PAIRS: tuple[tuple[str, str, float], ...] = (
    ("on-primary", "primary", 4.5),
    ("on-primary-container", "primary-container", 4.5),
    ("on-secondary", "secondary", 4.5),
    ("on-secondary-container", "secondary-container", 4.5),
    ("on-tertiary", "tertiary", 4.5),
    ("on-tertiary-container", "tertiary-container", 4.5),
    ("on-error", "error", 4.5),
    ("on-error-container", "error-container", 4.5),
    ("on-success", "success", 4.5),
    ("on-success-container", "success-container", 4.5),
    ("on-warning", "warning", 4.5),
    ("on-warning-container", "warning-container", 4.5),
    ("on-surface", "surface", 4.5),
    ("on-surface-variant", "surface", 4.5),
    ("on-surface", "surface-container-lowest", 4.5),
    ("on-surface", "surface-container-low", 4.5),
    ("on-surface", "surface-container", 4.5),
    ("on-surface", "surface-container-high", 4.5),
    ("on-surface", "surface-container-highest", 4.5),
    ("on-surface-variant", "surface-container", 4.5),
    ("on-surface-variant", "surface-container-high", 4.5),
    ("on-surface-variant", "surface-container-highest", 4.5),
    ("inverse-on-surface", "inverse-surface", 4.5),
    # A control edge and a meaningful graphic need 3.0, and no more.
    ("outline", "surface", 3.0),
    ("outline", "surface-container", 3.0),
    ("outline", "surface-container-high", 3.0),
    ("primary", "surface", 3.0),
    ("error", "surface", 3.0),
    ("success", "surface", 3.0),
    ("warning", "surface", 3.0),
    ("primary", "surface-container", 3.0),
    ("error", "surface-container", 3.0),
    ("success", "surface-container", 3.0),
    ("warning", "surface-container", 3.0),
)


def build() -> tuple[dict[str, str], dict[str, str], dict[str, dict[int, str]]]:
    """Give the light roles, the dark roles, and every palette."""
    palettes = {
        "primary": palette(SEED_PRIMARY, CHROMA["primary"]),
        "secondary": palette(SEED_PRIMARY, CHROMA["secondary"]),
        "tertiary": palette(SEED_PRIMARY, CHROMA["tertiary"], TERTIARY_HUE_SHIFT),
        "neutral": palette(SEED_PRIMARY, CHROMA["neutral"]),
        "neutral-variant": palette(SEED_PRIMARY, CHROMA["neutral-variant"]),
        "error": palette(SEED_ERROR, CHROMA["primary"]),
        "success": palette(SEED_SUCCESS, CHROMA["primary"]),
        "warning": palette(SEED_WARNING, CHROMA["primary"]),
    }

    light = {name: palettes[pal][lt] for name, pal, lt, _ in ROLES}
    dark = {name: palettes[pal][dk] for name, pal, _, dk in ROLES}
    return light, dark, palettes


def report(light: dict[str, str], dark: dict[str, str]) -> int:
    """Measure each pair in both modes. Give the count of the pairs that fail."""
    bad = 0
    for mode, roles in (("light", light), ("dark", dark)):
        print(f"\n  {mode.upper()} MODE")
        for front, back, limit in PAIRS:
            ratio = contrast(roles[front], roles[back])
            ok = ratio >= limit
            if not ok:
                bad += 1
            mark = "PASS" if ok else "FAIL"
            print(
                f"    {mark}  {ratio:5.2f}:1  (needs {limit})  "
                f"--m3-{front} on --m3-{back}"
            )
    return bad


def tonal_delta_check(palettes: dict[str, dict[int, str]]) -> None:
    """Test the claim of Material You about a tonal difference of 50.

    Material You says that a tonal difference of 50 or more gives WCAG AA. This
    function measures each pair of tones that has a difference of exactly 50, in
    each palette, and it gives the lowest ratio that it finds.
    """
    print("\n  THE CLAIM: a tonal difference of 50 gives AA (4.5:1)")
    lowest = 99.0
    where = ""
    for name, tones in palettes.items():
        available = sorted(tones)
        for first in available:
            second = first + 50
            if second in tones:
                ratio = contrast(tones[first], tones[second])
                if ratio < lowest:
                    lowest, where = ratio, f"{name} tone {first} and tone {second}"
    verdict = "the claim holds" if lowest >= 4.5 else "THE CLAIM FAILS"
    print(f"    lowest ratio at a difference of 50: {lowest:.2f}:1  ({where})")
    print(f"    {verdict}")


def css(light: dict[str, str], dark: dict[str, str]) -> str:
    """Give the text of the token stylesheet."""
    lines = [
        "/*",
        "  The Material Design 3 colour roles, the shape scale, the type scale,",
        "  and the spacing grid.",
        "",
        "  THIS FILE IS MADE BY A PROGRAM. Do not edit it by hand.",
        "  Run `uv run python tools/gen_m3_palette.py --write` to make it again.",
        "",
        "  Each colour comes from a tonal palette of one seed colour. A role, such",
        "  as `--m3-primary`, points to one tone. The light column and the dark",
        "  column use different tones of the same palette, which is why one set of",
        "  role names is enough for both modes.",
        "",
        "  Each pair of a text role and its container is measured with the WCAG",
        "  formula. Every pair is at 4.5:1 or more, in both modes. An edge or a",
        "  graphic that carries meaning is at 3.0:1 or more. The program fails and",
        "  writes nothing if one pair is below its limit, so this file cannot hold",
        "  a pair that does not pass.",
        "",
        f"  Seeds: primary {SEED_PRIMARY}, success {SEED_SUCCESS},",
        f"         error {SEED_ERROR}, warning {SEED_WARNING}",
        "*/",
        "",
        ":root {",
        "  color-scheme: light dark;",
        "",
        "  /* ---- The colour roles, light mode ---- */",
    ]

    for name in light:
        lines.append(f"  --m3-{name}: {light[name]};")

    lines += [
        "",
        "  /* ---- The shape scale ---- */",
        "  --shape-xs:    4px;",
        "  --shape-sm:    8px;",
        "  --shape-md:   12px;",
        "  --shape-lg:   16px;",
        "  --shape-xl:   28px;",
        "  --shape-full: 9999px;",
        "",
        "  /* ---- The spacing grid. Every step is a multiple of 4px. ---- */",
        "  --sp-1:  4px;",
        "  --sp-2:  8px;",
        "  --sp-3: 12px;",
        "  --sp-4: 16px;",
        "  --sp-5: 20px;",
        "  --sp-6: 24px;",
        "  --sp-8: 32px;",
        "  --sp-10: 40px;",
        "  --sp-12: 48px;",
        "  --sp-16: 64px;",
        "",
        "  /* ---- The type scale of M3. The pairs are the size and the line. ---- */",
        '  --font-plain: "Roboto", system-ui, -apple-system, "Segoe UI", sans-serif;',
        '  --font-mono: "Roboto Mono", ui-monospace, "SFMono-Regular", "Consolas", monospace;',
        "",
        "  --type-display-lg: 400 3.5625rem/4rem var(--font-plain);",
        "  --type-display-md: 400 2.8125rem/3.25rem var(--font-plain);",
        "  --type-display-sm: 400 2.25rem/2.75rem var(--font-plain);",
        "  --type-headline-lg: 400 2rem/2.5rem var(--font-plain);",
        "  --type-headline-md: 400 1.75rem/2.25rem var(--font-plain);",
        "  --type-headline-sm: 400 1.5rem/2rem var(--font-plain);",
        "  --type-title-lg: 400 1.375rem/1.75rem var(--font-plain);",
        "  --type-title-md: 500 1rem/1.5rem var(--font-plain);",
        "  --type-title-sm: 500 0.875rem/1.25rem var(--font-plain);",
        "  --type-body-lg: 400 1rem/1.5rem var(--font-plain);",
        "  --type-body-md: 400 0.875rem/1.25rem var(--font-plain);",
        "  --type-body-sm: 400 0.75rem/1rem var(--font-plain);",
        "  --type-label-lg: 500 0.875rem/1.25rem var(--font-plain);",
        "  --type-label-md: 500 0.75rem/1rem var(--font-plain);",
        "  --type-label-sm: 500 0.6875rem/1rem var(--font-plain);",
        "",
        "  /* ---- The tracking of the type scale ---- */",
        "  --track-title-md: 0.15px;",
        "  --track-title-sm: 0.1px;",
        "  --track-body-lg: 0.5px;",
        "  --track-body-md: 0.25px;",
        "  --track-body-sm: 0.4px;",
        "  --track-label-lg: 0.1px;",
        "  --track-label-md: 0.5px;",
        "",
        "  /* ---- Motion. These curves come from the M3 specification. ---- */",
        "  --ease-emphasized: cubic-bezier(0.2, 0, 0, 1);",
        "  --ease-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1);",
        "  --ease-accelerate: cubic-bezier(0.3, 0, 0.8, 0.15);",
        "  --ease-standard: cubic-bezier(0.2, 0, 0, 1);",
        "  --dur-short: 100ms;",
        "  --dur-medium: 250ms;",
        "  --dur-long: 400ms;",
        "",
        "  /* ---- The height of a target that a finger must hit ---- */",
        "  --target-min: 48px;",
        "}",
        "",
        "/*",
        "  Dark mode.",
        "",
        "  The browser default comes first, and the choice of the person comes",
        "  after it. So a person who selects light mode gets light mode on a",
        "  machine that asks for dark, and the reverse.",
        "*/",
        '@media (prefers-color-scheme: dark) {',
        '  :root:not([data-theme="light"]) {',
    ]

    for name in dark:
        lines.append(f"    --m3-{name}: {dark[name]};")

    lines += ["  }", "}", "", ':root[data-theme="dark"] {']
    for name in dark:
        lines.append(f"  --m3-{name}: {dark[name]};")
    lines += ["}", ""]

    return "\n".join(lines)


def main() -> int:
    light, dark, palettes = build()

    print("Material Design 3 tonal palettes, measured with the WCAG formula.")
    tonal_delta_check(palettes)
    bad = report(light, dark)

    print(f"\n  {len(PAIRS) * 2} pairs measured, {bad} below the limit.")

    if bad:
        print("\n  The palette is not written. Fix the roles above first.")
        return 1

    if "--write" in sys.argv:
        target = Path(__file__).parent.parent / "static" / "css" / "01-tokens.css"
        target.write_text(css(light, dark), encoding="utf-8")
        print(f"\n  Written: {target}")
    else:
        print("\n  Add `--write` to write `static/css/01-tokens.css`.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
