"""Tests of the design tokens.

`tools/gen_palette.py` makes `web/src/styles/tokens.css`. These tests hold the
guarantees of that program:

  each pair of a text colour and its surface passes its WCAG limit, at every hue
  that a change of preset can pass through;
  each colour is inside the sRGB gamut, so the browser maps nothing and the
  luminance on the screen is the luminance that the program measured;
  the file on the disk is the output of the program, so a hand edit fails here;
  the accent moves, the signal colours do not, and the accent keeps a chroma that
  reads as a colour.

These tests took the contrast half of the suite of the old interface. They did
not take its id contract tests, because a React build has no id contract to
break, and that suite is now deleted.
"""

from __future__ import annotations

import importlib.util
import re
from pathlib import Path
from types import ModuleType

import pytest

ROOT = Path(__file__).resolve().parent.parent

# The smallest chroma that still reads as a colour and not as a grey. An earlier
# form of the palette had an accent at 0.085, because one narrow hue in the arc of
# the presets pulled every preset down to it. This number stops that condition
# from coming back without a person seeing it.
COLOUR_FLOOR = 0.12

# The names that the shell of stage F3 reads. A token that goes away breaks a
# component, and this list makes that break a test failure and not a blank screen.
REQUIRED_TOKENS = (
    "--paper",
    "--paper-raised",
    "--paper-sunken",
    "--paper-edge",
    "--ink",
    "--ink-quiet",
    "--ink-faint",
    "--slab",
    "--ink-inverse",
    "--accent",
    "--accent-wash",
    "--on-accent",
    "--pass",
    "--fail",
    "--hold",
    "--font-serif",
    "--font-sans",
    "--font-mono",
    "--step-0",
    "--lh-body",
    "--sp-4",
    "--r-md",
    "--rule",
    "--ease-out",
    "--dur-base",
    "--dur-hue",
    "--target-min",
)


def _load_generator() -> ModuleType:
    """Load `tools/gen_palette.py` as a module.

    `tools` is not a package, so an ordinary import does not find the file.
    """
    path = ROOT / "tools" / "gen_palette.py"
    spec = importlib.util.spec_from_file_location("gen_palette", path)
    assert spec is not None, f"cannot read {path}"
    assert spec.loader is not None, f"cannot load {path}"
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


gen = _load_generator()
CSS = gen.css()


def _hue_gap(first: float, second: float) -> float:
    """Give the smallest angle between two hues, in degrees."""
    gap = abs(first - second) % 360.0
    return min(gap, 360.0 - gap)


def _token_lines(pattern: str) -> list[str]:
    """Give each line of the stylesheet that sets a token with this name."""
    return [line for line in CSS.splitlines() if re.match(pattern, line)]


# --------------------------------------------------------------------------
# The contrast and the gamut
# --------------------------------------------------------------------------


@pytest.mark.parametrize("mode", gen.MODES)
def test_no_pair_is_below_its_limit(mode: str) -> None:
    """Each pair passes its WCAG limit at every hue of the arc.

    The arc is the range of the hue of the accent. A change of preset moves the
    hue along a straight line, so a sweep passes through every hue between the two
    presets and each one of them must pass.
    """
    below = [
        f"--{front} on --{back} is {ratio:.2f}:1 at hue {hue:.1f}, and it needs {limit}"
        for front, back, limit, ratio, hue in gen.worst(mode)
        if ratio < limit
    ]
    assert below == []


def test_every_colour_is_inside_the_srgb_gamut() -> None:
    """No colour asks for more chroma than sRGB holds.

    A colour outside the gamut makes the browser map it to another one, and the
    mapped colour has a luminance that no test measured. So the fit of the chroma
    must leave nothing outside.
    """
    assert gen.gamut_failures() == []


def test_the_generator_reports_no_failure() -> None:
    """The whole report passes.

    `main()` writes no file when this count is not zero, so a palette that fails
    cannot reach the disk.
    """
    assert gen.report() == 0


# --------------------------------------------------------------------------
# The file on the disk
# --------------------------------------------------------------------------


def test_the_file_on_the_disk_is_the_output_of_the_program() -> None:
    """The stylesheet holds no hand edit.

    A hand edit puts a colour on the screen that no test measured. Change the
    generator and run it again instead.
    """
    target = gen.target_path()
    assert target.exists(), "run `uv run python tools/gen_palette.py --write`"
    on_disk = target.read_text(encoding="utf-8").replace("\r\n", "\n")
    assert on_disk == CSS, (
        "web/src/styles/tokens.css is not the output of tools/gen_palette.py. "
        "Change the generator and run it again. Do not edit the CSS by hand."
    )


def test_every_token_that_the_shell_needs_is_there() -> None:
    """Each token that a component reads is in the file."""
    missing = [name for name in REQUIRED_TOKENS if f"{name}:" not in CSS]
    assert missing == []


# --------------------------------------------------------------------------
# The hue that moves
# --------------------------------------------------------------------------


def test_the_hue_is_a_registered_property() -> None:
    """`--h` has a `@property` rule with a number syntax.

    A custom property with no rule is a string to the browser, and a string cannot
    be interpolated. The rule is what makes the sweep of the hue possible, so its
    absence is a silent loss of the animation.
    """
    match = re.search(r"@property --h \{(.*?)\}", CSS, re.DOTALL)
    assert match is not None, "the file has no `@property --h` rule"
    body = match.group(1)
    assert 'syntax: "<number>"' in body
    assert "inherits: true" in body
    assert "initial-value:" in body


def test_each_preset_writes_the_hue() -> None:
    """Each preset sets `--h` in light mode and in dark mode."""
    for name, light_hue, dark_hue, _ in gen.PRESETS:
        if name == gen.DEFAULT_PRESET:
            assert f"--h: {light_hue:.0f};" in CSS
            assert f"--h: {dark_hue:.0f};" in CSS
            continue
        light = f':root[data-hue="{name}"] {{ --h: {light_hue:.0f}; }}'
        dark = f':root[data-theme="dark"][data-hue="{name}"] {{ --h: {dark_hue:.0f}; }}'
        assert light in CSS, light
        assert dark in CSS, dark


def test_the_accent_reads_the_hue() -> None:
    """Each accent colour takes its hue from `--h`, so a preset moves all of them."""
    lines = _token_lines(r"\s*--accent(-\w+)?:")
    assert lines, "the file sets no accent colour"
    assert all("var(--h)" in line for line in lines), lines


def test_the_chroma_of_the_accent_does_not_move() -> None:
    """The chroma of the accent is a number and not a variable.

    The edge of the sRGB gamut curves. A straight line between two chromas that
    are both inside the gamut can pass outside it, so a chroma that moves with the
    hue puts colours outside the gamut in the middle of a sweep. One number for
    the whole arc cannot do that.
    """
    assert "var(--c-" not in CSS


@pytest.mark.parametrize("mode", gen.MODES)
def test_the_accent_keeps_a_chroma_that_reads_as_a_colour(mode: str) -> None:
    """The solid fill of the accent is not a grey.

    The chroma of the accent is the smallest chroma of the whole arc of the
    presets. A preset in a narrow part of the gamut makes that number small and
    every preset pale, so the arc must stay in a wide part.
    """
    fill = gen.accent_chroma(mode)[""]
    assert fill >= COLOUR_FLOOR, f"the accent fill of {mode} mode is {fill:.4f}"


# --------------------------------------------------------------------------
# The colours that do not move
# --------------------------------------------------------------------------


def test_the_signal_colours_do_not_move() -> None:
    """A signal colour holds its own hue.

    Green means a pass and red means a failure. A signal colour that followed the
    accent would lose that meaning at each change of preset.
    """
    names = "|".join(gen.SIGNAL_HUES)
    lines = _token_lines(rf"\s*--({names})(-\w+)?:")
    assert lines, "the file sets no signal colour"
    assert all("var(--h)" not in line for line in lines), lines


def test_each_signal_colour_holds_its_own_hue() -> None:
    """Each step of a signal family ends with the hue of that signal."""
    for name, (hue, _) in gen.SIGNAL_HUES.items():
        lines = _token_lines(rf"\s*--{name}(-\w+)?:")
        assert lines, name
        for line in lines:
            assert line.rstrip().endswith(f"{hue:.0f});"), line


def test_the_arc_of_the_accent_holds_no_signal_hue() -> None:
    """No hue of a sweep comes near a signal hue.

    An accent that looked green would take the meaning of the green mark. The gap
    is 40 degrees, which is enough that no person reads one colour as the other.
    """
    for hue in gen.arc_hues():
        for name, (signal_hue, _) in gen.SIGNAL_HUES.items():
            gap = _hue_gap(hue, signal_hue)
            assert gap >= 40.0, f"hue {hue:.1f} is {gap:.1f} degrees from {name}"


def test_the_neutrals_are_grey() -> None:
    """A neutral has almost no chroma, so it reads as a grey and not as a tint."""
    for name, (_, chroma) in gen.NEUTRAL_LIGHT.items():
        assert chroma <= 0.01, f"{name} has a chroma of {chroma:.4f}"
    for name, (_, chroma) in gen.NEUTRAL_DARK.items():
        assert chroma <= 0.01, f"{name} has a chroma of {chroma:.4f}"


# --------------------------------------------------------------------------
# The old palette does not leak
# --------------------------------------------------------------------------


def test_no_name_of_the_old_palette_is_here() -> None:
    """No name of the old palette comes back.

    The palette of the old interface put `--m3-` in front of each role name. Those
    files are deleted, so this test holds the history of the repository out.
    """
    assert "--m3-" not in CSS


def test_the_file_holds_no_hex_colour() -> None:
    """Every colour is in `oklch()`.

    A hex colour cannot follow `--h`, and its lightness is not the number that the
    contrast measurement uses.
    """
    found = re.findall(r"#[0-9a-fA-F]{3,8}\b", CSS)
    assert found == []


def test_the_type_families_are_the_installed_names() -> None:
    """The font stack names the families that `@fontsource` installs.

    The package installs the family as `Geist Sans`, and a stack that says `Geist`
    falls through to the system face with no error and no sign on the screen.
    """
    for family in ('"Instrument Serif"', '"Geist Sans"', '"Geist Mono"'):
        assert family in CSS, family
    assert '"Geist",' not in CSS


def test_dark_mode_answers_the_machine_and_the_person() -> None:
    """The choice of the person comes after the wish of the machine.

    So a person who selects light mode gets light mode on a machine that asks for
    dark mode.
    """
    assert "@media (prefers-color-scheme: dark)" in CSS
    assert ':root:not([data-theme="light"])' in CSS
    assert ':root[data-theme="dark"] {' in CSS