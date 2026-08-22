"""The two commits of Phase 2 must answer without a repository and without a token.

Three states of the settings reach `commit_assets`, and none of them may raise.
Fixture mode is the state that the whole interface is built under, because the
free tier gives 20 model calls a day. The other two are states that a person can
be in on the first deploy, and a person who is in one of them must read a sentence
that says which value to set, and not a 500.
"""

from __future__ import annotations

import pytest

import config
from models import GeneratedAssets, PortfolioCard
from sync import github as github_sync

REPO_URL = "https://github.com/owner/name"


def _assets() -> GeneratedAssets:
    return GeneratedAssets(
        doc_sheet_md="# A sheet",
        portfolio_card=PortfolioCard(title="A project", tagline="One line."),
        resume_bullets=["One bullet."],
        social_draft="A post.",
    )


def _commit() -> github_sync.CommitResults:
    return github_sync.commit_assets(
        project_name="A Project", assets=_assets(), repo_url=REPO_URL
    )


def test_fixture_mode_gives_two_shas_and_calls_no_repository(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(config, "FIXTURE_MODE", True)

    def _forbidden() -> None:
        raise AssertionError("Fixture mode must make no GitHub client.")

    monkeypatch.setattr(github_sync, "_client", _forbidden)

    results = _commit()

    # Both commits must report success, because the approval route writes
    # COMPLETED only when both of them hold a value.
    assert results.doc_commit_sha
    assert results.card_commit_sha
    assert results.doc_error is None
    assert results.card_error is None


def test_a_token_that_is_absent_gives_two_errors_and_no_exception(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(config, "FIXTURE_MODE", False)
    monkeypatch.setattr(config, "GITHUB_TOKEN", "")
    monkeypatch.setattr(config, "PORTFOLIO_DATA_REPO", "owner/portfolio-data")

    results = _commit()

    assert results.doc_commit_sha is None
    assert results.card_commit_sha is None
    assert "GITHUB_TOKEN" in (results.doc_error or "")
    assert "GITHUB_TOKEN" in (results.card_error or "")


def test_a_portfolio_repository_that_is_absent_gives_two_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(config, "FIXTURE_MODE", False)
    monkeypatch.setattr(config, "PORTFOLIO_DATA_REPO", "")

    results = _commit()

    assert results.doc_commit_sha is None
    assert results.card_commit_sha is None
    assert "PORTFOLIO_DATA_REPO" in (results.doc_error or "")
    assert "PORTFOLIO_DATA_REPO" in (results.card_error or "")
