"""The tests of the review desk.

The interface is plain ES modules and plain stylesheets, with no build step, so
`pytest` cannot import it. The first test calls Node on `desk_harness.mjs`, which
gives the modules a fake DOM and a fake service, and then reads the page that
they wrote. That test passes over itself when the machine has no Node. Node is
not a dependency of the product: the container serves the files, and the browser
reads them. Node is here only to test them.

The tests after it need no Node. They read `index.html` and the folders beside
it, and they hold the page and the files to the same list.

Why these tests are necessary: a fault in the interface does not stop the API. A
module that throws at import stops the whole page, and each request still gets
the same answer as before. A stylesheet that the page names with one wrong letter
gives a page with no design, and again each request gets the same answer. So a
probe of the API cannot find either one. One such fault was in the interface for
a full day. See `docs/VERIFICATION_LEDGER.md` row 5.1.
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
