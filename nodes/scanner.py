"""The repository scan. This node is plain Python and makes no model request.

The scan is a code node for two reasons. First, a filter is exact work and a
model does it worse. Second, an `output_schema` on an agent stops all tool use,
so an agent that has a schema cannot call a scan tool.

The filter runs before the request to the model, not after it. A large
repository can fill the whole context window with dependency code.
"""

from __future__ import annotations

import base64
import time
from typing import Any

import httpx
from google.adk import Context

import config
from models import RepoScan, ScannedFile

GITHUB_API = "https://api.github.com"

IGNORE_DIRS = frozenset(
    {
        ".git",
        ".github",
        "node_modules",
        "vendor",
        "dist",
        "build",
        "__pycache__",
        ".venv",
        "venv",
        "target",
        ".next",
        "coverage",
        ".pytest_cache",
        "site-packages",
    }
)

IGNORE_EXTENSIONS = frozenset(
    {
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".svg",
        ".ico",
        ".pdf",
        ".zip",
        ".tar",
        ".gz",
        ".mp4",
        ".mov",
        ".woff",
        ".woff2",
        ".ttf",
        ".pyc",
        ".so",
        ".dll",
        ".exe",
        ".lock",
    }
)

MANIFEST_NAMES = frozenset(
    {
        "pyproject.toml",
        "requirements.txt",
        "package.json",
        "go.mod",
        "Cargo.toml",
        "pom.xml",
        "build.gradle",
        "Gemfile",
        "composer.json",
        "Dockerfile",
    }
)

MAX_FILE_SIZE_BYTES = 100 * 1024
"""The largest single file that the scan reads. The value is 100 KB."""

MAX_TOTAL_BYTES = 400 * 1024
"""The budget for all of the files together. The value is 400 KB."""

MAX_FILES = 40
"""The largest number of files that the scan sends to the model."""

RECENT_COMMITS = 25


class ScanError(RuntimeError):
    """The scan failed after a retry. The transaction becomes `FAILED_SCAN`."""


def parse_repo_url(repo_url: str) -> str:
    """Get `owner/name` from the URL of a GitHub repository.

    The function accepts a URL with or without the `.git` end, and with or
    without a slash at the end.
    """
    cleaned = repo_url.strip().rstrip("/")
    if cleaned.endswith(".git"):
        cleaned = cleaned[: -len(".git")]
    parts = [p for p in cleaned.split("/") if p]
    if len(parts) < 2:
        raise ScanError(f"The URL {repo_url!r} does not hold an owner and a name.")
    return f"{parts[-2]}/{parts[-1]}"


def is_relevant_file(file_path: str, file_size: int) -> bool:
    """Tell if a file must go into the context of the model.

    A file goes into the context only if it is in no ignored folder, has no
    ignored extension, and is not too large.
    """
    segments = file_path.split("/")
    if any(segment in IGNORE_DIRS for segment in segments):
        return False
    lowered = file_path.lower()
    if any(lowered.endswith(ext) for ext in IGNORE_EXTENSIONS):
        return False
    return file_size <= MAX_FILE_SIZE_BYTES


def _headers() -> dict[str, str]:
    """Build the headers for a GitHub request.

    Every call must have a token. GitHub gives 60 requests each hour to a call
    with no token, and 5,000 requests each hour to a call with a token. A demo
    uses all of 60 requests quickly.
    """
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "ProjectSync/0.1",
    }
    if config.GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {config.GITHUB_TOKEN}"
    return headers


def _get(client: httpx.Client, path: str, **params: Any) -> Any:
    """Make one GET request and retry one time if the limit stops it.

    A 403 or a 429 with a rate-limit header means that the limit stopped the
    call. The function waits and then makes the call one more time. Any other
    error code raises `ScanError` immediately.
    """
    for attempt in (1, 2):
        response = client.get(path, params=params or None)
        if response.status_code == 200:
            return response.json()

        limited = response.status_code == 429 or (
            response.status_code == 403
            and response.headers.get("x-ratelimit-remaining") == "0"
        )
        if limited and attempt == 1:
            wait_for = min(float(response.headers.get("retry-after", 5)), 20.0)
            time.sleep(wait_for)
            continue

        raise ScanError(
            f"GitHub gave {response.status_code} for {path}: {response.text[:200]}"
        )

    raise ScanError(f"GitHub stopped the call to {path} two times.")


def _decode(blob: dict[str, Any]) -> str | None:
    """Get the text of a file from a GitHub contents response."""
    if blob.get("encoding") != "base64" or not blob.get("content"):
        return None
    try:
        return base64.b64decode(blob["content"]).decode("utf-8", errors="replace")
    except (ValueError, TypeError):
        return None


def scan_github_repository(
    ctx: Context,
    repo_url: str,
    user_id: str = "default",
    commit_sha: str | None = None,
) -> RepoScan:
    """Read a GitHub repository and give the facts that the agents need.

    This function is the first node of the graph.

    The node keeps the default parameter binding, which is `"state"`. So each
    parameter here comes from `ctx.state` by its name. The caller puts the three
    values into the state with the `state_delta` argument of `run_async`.

    Do not give this node a parameter with the name `node_input`. The START node
    gives user content of the type `types.Content`, and that type does not change
    into a model. The state is the correct way to send the first input.

    Args:
      ctx: The context of the run. The function writes state through it.
      repo_url: The full URL of the repository to read.
      user_id: The person who owns the style rules.
      commit_sha: Read this commit and not the head of the branch. The demo uses
        this argument to scan an early, incomplete commit.

    Returns:
      A `RepoScan` with the README, the build files, the most changed files, the
      recent commit messages, and the shape of the folders.

    Raises:
      ScanError: The repository is not readable after one retry.
    """
    repo_name = parse_repo_url(repo_url)

    # A later node needs the name of the repository, and the output of an agent
    # node does not carry it forward. The framework writes each change to the
    # state into the event, so the session service keeps it.
    ctx.state["repo_name"] = repo_name

    with httpx.Client(
        base_url=GITHUB_API, headers=_headers(), timeout=30.0, follow_redirects=True
    ) as client:
        repo = _get(client, f"/repos/{repo_name}")
        default_branch = repo.get("default_branch", "main")

        ref = commit_sha or default_branch
        tree = _get(client, f"/repos/{repo_name}/git/trees/{ref}", recursive="1")

        blobs = [item for item in tree.get("tree", []) if item.get("type") == "blob"]
        total_files_seen = len(blobs)

        relevant = [
            item
            for item in blobs
            if is_relevant_file(item["path"], item.get("size", 0))
        ]
        # Put the smallest files first. Many small source files carry more
        # signal than one large file.
        relevant.sort(key=lambda item: item.get("size", 0))

        all_paths = [item["path"] for item in blobs]
        readme = None
        manifests: dict[str, str] = {}
        files: list[ScannedFile] = []
        payload_bytes = 0

        for item in relevant:
            path = item["path"]
            base_name = path.split("/")[-1]
            is_manifest = base_name in MANIFEST_NAMES
            is_readme = base_name.lower().startswith("readme")

            if not (is_manifest or is_readme) and len(files) >= MAX_FILES:
                continue
            if payload_bytes >= MAX_TOTAL_BYTES:
                break

            blob = _get(client, f"/repos/{repo_name}/git/blobs/{item['sha']}")
            text = _decode(blob)
            if text is None:
                continue

            payload_bytes += len(text.encode("utf-8"))
            if is_readme and readme is None:
                readme = text
            elif is_manifest:
                manifests[path] = text
            else:
                files.append(
                    ScannedFile(path=path, size_bytes=item.get("size", 0), content=text)
                )

        commits = _get(
            client, f"/repos/{repo_name}/commits", sha=ref, per_page=RECENT_COMMITS
        )

    lowered_paths = [p.lower() for p in all_paths]
    return RepoScan(
        repo_url=repo_url,
        repo_name=repo_name,
        default_branch=default_branch,
        commit_sha=commit_sha or (commits[0]["sha"] if commits else ""),
        readme=readme,
        manifests=manifests,
        files=files,
        directory_shape=sorted(
            {p.split("/")[0] for p in all_paths if "/" in p and p.split("/")[0] not in IGNORE_DIRS}
        ),
        recent_commit_messages=[
            c.get("commit", {}).get("message", "").split("\n")[0] for c in commits
        ],
        total_files_seen=total_files_seen,
        files_kept=len(files) + len(manifests) + (1 if readme else 0),
        payload_bytes=payload_bytes,
        has_tests=any(
            "test" in p or "spec" in p for p in lowered_paths
        ),
        has_license=any(
            p.startswith("license") or p.startswith("licence") for p in lowered_paths
        ),
        has_ci=any(p.startswith(".github/workflows/") for p in lowered_paths),
    )
