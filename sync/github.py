"""The Phase 2 commits. This module writes to GitHub.

Two commits go to two different repositories:

1. The documentation sheet goes to the repository that it documents, in the
   folder from `SYNCED_DOCS_PATH`. That repository is public, so a judge can open
   the commit.
2. The portfolio card goes to the private `portfolio-data` repository, as JSON.

The two commits are independent. If one fails and the other succeeds, the
transaction row keeps that fact and the dashboard offers a retry for only the
part that failed. A partial failure is a partial success.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass

from github import Auth, Github, GithubException

import config
from models import GeneratedAssets

logger = logging.getLogger(__name__)


class CommitError(RuntimeError):
    """A commit failed. The caller keeps the other commit."""


@dataclass
class CommitResults:
    """What the two commits gave back.

    A value of `None` means that this commit did not happen. The two fields are
    independent flags, and the transaction row keeps both.
    """

    doc_commit_sha: str | None = None
    card_commit_sha: str | None = None
    doc_error: str | None = None
    card_error: str | None = None


def slugify(name: str) -> str:
    """Make a safe file name from the name of a project.

    The result holds only small letters, numbers, and a dash.
    """
    lowered = name.strip().lower()
    cleaned = re.sub(r"[^a-z0-9]+", "-", lowered).strip("-")
    return cleaned or "project"


def _client() -> Github:
    """Make the GitHub client.

    The token needs the `repo` scope, because the client must read and write.
    """
    if not config.GITHUB_TOKEN:
        raise CommitError("GITHUB_TOKEN is not set, so no commit can happen.")
    return Github(auth=Auth.Token(config.GITHUB_TOKEN))


def upsert_file(
    client: Github, repo_name: str, path: str, content: str, message: str
) -> str:
    """Write a file, and make it if it is not there.

    Read the file first to get its SHA. `create_file` on a file that exists gives
    error 422, so a create-only call fails on the second run of the same project.
    This function writes the first time and each time after it.

    Args:
      client: The GitHub client.
      repo_name: The repository, in the form `owner/name`.
      path: The path of the file inside the repository.
      content: The text to write.
      message: The commit message.

    Returns:
      The SHA of the new commit.

    Raises:
      CommitError: The write failed.
    """
    try:
        repo = client.get_repo(repo_name)
    except GithubException as error:
        raise CommitError(f"The repository {repo_name} is not readable: {error}") from error

    try:
        existing = repo.get_contents(path)
        # `get_contents` gives a list for a folder. A list here means that the
        # path is a folder, and a file cannot go over it.
        if isinstance(existing, list):
            raise CommitError(f"The path {path} in {repo_name} is a folder.")
        result = repo.update_file(path, message, content, existing.sha)
    except GithubException as error:
        if error.status != 404:
            raise CommitError(f"The write of {path} failed: {error}") from error
        try:
            result = repo.create_file(path, message, content)
        except GithubException as create_error:
            raise CommitError(
                f"The creation of {path} failed: {create_error}"
            ) from create_error

    return result["commit"].sha


def commit_assets(
    target_repo: str, project_name: str, assets: GeneratedAssets, repo_url: str
) -> CommitResults:
    """Write the documentation sheet and the portfolio card.

    The function tries both commits. It does not stop at the first failure,
    because the two results are independent.

    Args:
      target_repo: The repository that the documentation sheet goes to. This is
        the repository that the scan read.
      project_name: The name of the project. The file name comes from it.
      assets: The four assets from the generator.
      repo_url: The URL of the repository. It goes into the card.

    Returns:
      A `CommitResults` with one SHA for each commit that succeeded, and one
      message for each commit that failed.
    """
    results = CommitResults()
    slug = slugify(project_name)
    client = _client()

    # Target 1: the documentation sheet goes to the repository of the user.
    try:
        results.doc_commit_sha = upsert_file(
            client,
            target_repo,
            f"{config.SYNCED_DOCS_PATH}/{slug}.md",
            assets.doc_sheet_md,
            f"docs: add the {slug} sheet through ProjectSync",
        )
    except CommitError as error:
        results.doc_error = str(error)
        logger.error("The documentation commit failed: %s", error)

    # Target 2: the portfolio card goes to the private portfolio-data repository.
    if not config.PORTFOLIO_DATA_REPO:
        results.card_error = "PORTFOLIO_DATA_REPO is not set."
    else:
        try:
            card = assets.portfolio_card.model_dump(mode="json")
            # `PortfolioCard.repo_url` has the default value `""`, so the key is
            # always in the dictionary. A test for the value is necessary here.
            # `setdefault` would look at the key, find it, and keep the empty text.
            if not card["repo_url"]:
                card["repo_url"] = repo_url
            results.card_commit_sha = upsert_file(
                client,
                config.PORTFOLIO_DATA_REPO,
                f"cards/{slug}.json",
                json.dumps(card, indent=2, ensure_ascii=False),
                f"portfolio: add the {slug} card",
            )
        except CommitError as error:
            results.card_error = str(error)
            logger.error("The portfolio card commit failed: %s", error)

    return results
