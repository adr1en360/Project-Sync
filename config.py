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

MODEL: str = os.environ.get("MODEL_ID", "gemini-3.7-flash")
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
GOOGLE_CLOUD_PROJECT: str = os.environ.get("GOOGLE_CLOUD_PROJECT", "")
GOOGLE_CLOUD_LOCATION: str = os.environ.get("GOOGLE_CLOUD_LOCATION", "global")

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

# --------------------------------------------------------------------------
# Dashboard
# --------------------------------------------------------------------------

DASHBOARD_BASE_URL: str = os.environ.get("DASHBOARD_BASE_URL", "http://localhost:8080")


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
    return sorted(name for name, value in required.items() if not value)
