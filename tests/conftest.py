"""Settings that every test needs.

The tests must run with no Google Cloud project and no GitHub token. So this file
puts a dummy value in each variable that `config.py` reads, before the first test
imports `config`.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# The modules of the project are at the top of the repository, and not in a `src`
# folder. So the root must be on the path.
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# `config.py` calls `load_dotenv()`, which does not write over a variable that is
# already set. So these values win over a `.env` file, and a test gives the same
# result on every machine.
os.environ.setdefault("MODEL_ID", "gemini-3.7-flash")
os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "False")
os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "test-project")
os.environ.setdefault("GITHUB_TOKEN", "test-token-not-real")
os.environ.setdefault("PORTFOLIO_DATA_REPO", "test-owner/portfolio-data")

# The live test in `test_style_rules_change_output.py` makes a real model call, and
# it needs the real key from `.env`. A fake key here would hide that key, because
# `load_dotenv()` does not write over a variable that is already set. So the fake
# key goes in only when the live tests are off.
#
# The other names above stay fake in each case. The live test makes no Firestore
# call and no GitHub call, so it needs no other real value.
if os.environ.get("RUN_LIVE_TESTS") != "1":
    os.environ.setdefault("GOOGLE_API_KEY", "test-key-not-real")
