"""Configuration for ProjectSync. This module is read one time at import.

All values come from the environment. The names of the first three variables are
fixed by the Google GenAI SDK. Do not change them. If you use a different name,
the SDK ignores the value and calls the direct API.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

# --------------------------------------------------------------------------
# Model
# --------------------------------------------------------------------------

MODEL: str = os.environ.get("MODEL_ID", "gemini-3.5-flash")
"""The model for all three agent nodes."""

# The hackathon rules give a floor of Gemini 3.5. Gemini 3 Flash is below the
# floor. Stage One of the judging is pass or fail, so a model below the floor
# removes the entry. This assert stops the application at import.
_PERMITTED_PREFIXES = ("gemini-3.5", "gemini-3.7", "gemini-4")
assert MODEL.startswith(_PERMITTED_PREFIXES), (
    f"MODEL_ID={MODEL!r} is below the mandated Gemini 3.5 floor. "
    f"Use one of {_PERMITTED_PREFIXES}. See docs/VERIFICATION_LEDGER.md L2.3."
)

# --------------------------------------------------------------------------
# Google Cloud
# --------------------------------------------------------------------------

USE_VERTEX_AI: bool = os.environ.get("GOOGLE_GENAI_USE_VERTEXAI", "").lower() in (
    "1",
    "true",
    "yes",
)
"""Tells if the run goes to Vertex AI or to the direct Gemini API.

`GOOGLE_GENAI_USE_VERTEXAI` is deprecated. The new name is
`GOOGLE_GENAI_USE_ENTERPRISE`. The old name still works, so this project keeps it,
and a `DeprecationWarning` in a test run is not a problem. Both the GenAI SDK and
ADK read the new name first and the old name second. See ledger row 2.13.
"""
GOOGLE_CLOUD_PROJECT: str = os.environ.get("GOOGLE_CLOUD_PROJECT", "")
GOOGLE_CLOUD_LOCATION: str = os.environ.get("GOOGLE_CLOUD_LOCATION", "global")

GOOGLE_API_KEY: str = os.environ.get("GOOGLE_API_KEY", "")
"""The key for the direct Gemini API.

The Google GenAI SDK reads this variable from the environment itself, so no part of
this application gives the key to the SDK. This name is here for one purpose: the
health check must tell a person that the key is absent. Vertex AI does not use it.
"""

# --------------------------------------------------------------------------
# GitHub
# --------------------------------------------------------------------------

GITHUB_TOKEN: str = os.environ.get("GITHUB_TOKEN", "")
"""A token with the `repo` scope. The token must read and write."""

PORTFOLIO_DATA_REPO: str = os.environ.get("PORTFOLIO_DATA_REPO", "")
"""The private repository for the portfolio cards. The format is `owner/name`."""

SYNCED_DOCS_PATH: str = os.environ.get("SYNCED_DOCS_PATH", "docs/synced")
"""The folder for the generated documentation sheets. This folder keeps the
generated files apart from the files that a person wrote."""

# --------------------------------------------------------------------------
# Firestore
# --------------------------------------------------------------------------

FIRESTORE_TRANSACTIONS: str = os.environ.get(
    "FIRESTORE_TRANSACTIONS", "projectsync_transactions"
)
"""The collection for the transaction rows. The specification fixes this name."""

FIRESTORE_STYLE_RULES: str = os.environ.get("FIRESTORE_STYLE_RULES", "style_rules")
FIRESTORE_USERS: str = os.environ.get("FIRESTORE_USERS", "users")

# Stage 4 collections
FIRESTORE_RESUME_BULLETS: str = os.environ.get(
    "FIRESTORE_RESUME_BULLETS", "resume_bullets"
)
FIRESTORE_SOCIAL_DRAFTS: str = os.environ.get(
    "FIRESTORE_SOCIAL_DRAFTS", "social_drafts"
)

# --------------------------------------------------------------------------
# Dashboard
# --------------------------------------------------------------------------

DASHBOARD_BASE_URL: str = os.environ.get("DASHBOARD_BASE_URL", "http://localhost:8080")

ALLOWED_ORIGINS: list[str] = [
    origin.strip()
    for origin in os.environ.get("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
"""The origins that a browser may call the API from.

The interface comes from the same service, so this list is empty by default and
the application adds no CORS rule. A browser needs no CORS for a same-origin
request. Give this variable a value only if you serve the interface from a
different host.
"""

# --------------------------------------------------------------------------
# Development / Testing
# --------------------------------------------------------------------------

FIXTURE_MODE: bool = os.environ.get("FIXTURE_MODE", "").lower() in ("1", "true", "yes")
"""When true, run_workflow walks the graph without a call to the model.

This makes all UI work cost zero model calls. Set FIXTURE_MODE=1 for local
development and demo rehearsals against the 20 daily requests budget.
"""

FIXTURE_NODE_DELAY: float = float(os.environ.get("FIXTURE_NODE_DELAY", "0.6"))
"""The seconds that each node takes in fixture mode.

A fixture run writes the same event log as a real run. The delay makes the
progress of the run possible to see, and it gives a person the time to press
cancel. Seven nodes at the default value take about four seconds, where a real
run takes 30 to 90.

Set the value to 0 in a test. A test does not look at the screen.
"""


def missing_required() -> list[str]:
    """Give the names of the variables that the application needs but does not have.

    The health endpoint uses this function to report the configuration. The
    import does not fail for these variables, because the smoke test must run
    before you have a Google Cloud project.
    """
    required = {
        "GOOGLE_CLOUD_PROJECT": GOOGLE_CLOUD_PROJECT,
        "GITHUB_TOKEN": GITHUB_TOKEN,
        "PORTFOLIO_DATA_REPO": PORTFOLIO_DATA_REPO,
    }

    # The route to Gemini decides which credential is necessary. Vertex AI uses the
    # project and the credentials of the machine. The direct API uses a key. A report
    # of both names tells a person to set a variable that this route never reads.
    if not USE_VERTEX_AI:
        required["GOOGLE_API_KEY"] = GOOGLE_API_KEY

    return sorted(name for name, value in required.items() if not value)
