"""The test of the review desk, which runs in Node and not in a browser.

The interface is plain ES modules with no build step, so `pytest` cannot import
it. This test calls Node on `desk_harness.mjs`, which gives the modules a fake
DOM and a fake service, and then reads the page that they wrote.

The test passes over itself when the machine has no Node. Node is not a
dependency of the product: the container serves the modules as files, and the
browser reads them. Node is here only to test them.

Why this test is necessary: a module that throws at import stops the whole page,
and the API still answers each request as before. So a probe of the API cannot
find that fault. One such fault was in the interface for a full day. See
`docs/VERIFICATION_LEDGER.md` row 5.1.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

HARNESS = Path(__file__).parent / "desk_harness.mjs"

NODE = shutil.which("node")

pytestmark = pytest.mark.skipif(
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
