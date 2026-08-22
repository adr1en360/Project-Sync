"""The fixture run must write the same event log as a real run.

A fixture that writes only the final row gives a demonstration and not a test.
The tests here fail if the fixture goes back to that behaviour. The run screen
reads the event log, so an empty log shows seven rows that never move, and a
person cannot test the product without paying for a model call.
"""

from __future__ import annotations

import asyncio

import adk_runtime
import config
import store
from adk_runtime import GRAPH_NODES
from models import RunEventState, Transaction, TransactionStatus


class FakeStore:
    """An in-memory stand-in for the Firestore calls that a fixture run makes.

    The project has no Firestore in a test. This class holds the events and the
    rows in memory, and it gives a clock that counts, so a test can compare the
    order of two stamps.
    """

    def __init__(self) -> None:
        self.events: list[dict] = []
        self.rows: dict[str, Transaction] = {}
        self.cancel = False
        self._tick = 0

    def now_iso(self) -> str:
        self._tick += 1
        return f"2026-08-22T00:00:{self._tick:02d}+00:00"

    def append_run_event(
        self,
        tx_id: str,
        node: str,
        state: RunEventState,
        *,
        started_at: str | None = None,
        finished_at: str | None = None,
        error: str | None = None,
    ) -> str:
        self.events.append(
            {
                "tx_id": tx_id,
                "node": node,
                "state": state,
                "started_at": started_at or self.now_iso(),
                "finished_at": finished_at,
                "error": error,
            }
        )
        return f"event-{len(self.events)}"

    def get_transaction(self, tx_id: str) -> Transaction | None:
        return self.rows.get(tx_id)

    def save_transaction(self, transaction: Transaction) -> None:
        self.rows[transaction.tx_id] = transaction

    def update_transaction(self, tx_id: str, **fields: object) -> None:
        row = self.rows[tx_id]
        self.rows[tx_id] = row.model_copy(update=fields)

    def cancel_requested(self, tx_id: str) -> bool:
        return self.cancel


def install(monkeypatch, fake: FakeStore) -> None:
    """Put the fake in the place of each store call, and turn the delay off."""
    for name in (
        "now_iso",
        "append_run_event",
        "get_transaction",
        "save_transaction",
        "update_transaction",
        "cancel_requested",
    ):
        monkeypatch.setattr(store, name, getattr(fake, name))
    monkeypatch.setattr(config, "FIXTURE_MODE", True)
    # A test does not look at the screen, so no node needs to take time.
    monkeypatch.setattr(config, "FIXTURE_NODE_DELAY", 0)


def start(tx_id: str = "tx-1") -> None:
    """Run one fixture run through the real door of the module."""
    asyncio.run(
        adk_runtime.run_workflow(
            # The node is never read in fixture mode. The flag sends the call to
            # the fixture before the runner is made.
            None,  # type: ignore[arg-type]
            "Catalogue owner/name",
            user_id="default",
            session_id=tx_id,
            state={"tx_id": tx_id, "repo_url": "owner/name", "user_id": "default"},
        )
    )


def seed(fake: FakeStore, tx_id: str = "tx-1", repo: str = "someone/thing") -> None:
    """Write the row that `trigger-sync` writes before the graph starts."""
    fake.rows[tx_id] = Transaction(
        tx_id=tx_id,
        user_id="default",
        repo_url=f"https://github.com/{repo}",
        repo_name=repo,
        status=TransactionStatus.RUNNING,
        created_at="2026-08-22T00:00:00+00:00",
    )


def test_fixture_writes_a_start_and_an_end_for_every_node(monkeypatch) -> None:
    """Every node of the graph must appear in the log, in the order of the graph."""
    fake = FakeStore()
    install(monkeypatch, fake)
    seed(fake)

    start()

    assert len(fake.events) == len(GRAPH_NODES) * 2, (
        "A fixture run must log a start and an end for each of the seven nodes. "
        "An empty or short log leaves the run screen with rows that never move."
    )
    assert [event["node"] for event in fake.events[::2]] == list(GRAPH_NODES)
    assert {event["state"] for event in fake.events} == {
        RunEventState.STARTED,
        RunEventState.COMPLETED,
    }
    for event in fake.events[1::2]:
        assert event["finished_at"] is not None


def test_fixture_ends_at_pending_approval(monkeypatch) -> None:
    """The run stops for the person, and the row says so."""
    fake = FakeStore()
    install(monkeypatch, fake)
    seed(fake)

    start()

    assert fake.rows["tx-1"].status == TransactionStatus.PENDING_APPROVAL


def test_fixture_keeps_the_repository_and_the_start_of_the_person(monkeypatch) -> None:
    """The fixture file names another repository, and the row must not take it.

    A screen that shows a repository that nobody asked for reads as a defect.
    """
    fake = FakeStore()
    install(monkeypatch, fake)
    seed(fake, repo="someone/thing")

    start()

    row = fake.rows["tx-1"]
    assert row.repo_name == "someone/thing"
    assert row.repo_url == "https://github.com/someone/thing"
    assert row.created_at == "2026-08-22T00:00:00+00:00"


def test_fixture_stops_at_the_node_that_was_at_work(monkeypatch) -> None:
    """A cancel stops the run, and the log names the node that was at work.

    The row must also become CANCELLED. The cancel endpoint is legal only while
    the row says RUNNING, so a fixture that finished too quickly to cancel made
    the control impossible to test.
    """
    fake = FakeStore()
    install(monkeypatch, fake)
    seed(fake)
    fake.cancel = True

    start()

    assert [event["state"] for event in fake.events] == [
        RunEventState.STARTED,
        RunEventState.CANCELLED,
    ]
    assert fake.events[0]["node"] == GRAPH_NODES[0]
    assert fake.events[1]["node"] == GRAPH_NODES[0]
    assert fake.rows["tx-1"].status == TransactionStatus.CANCELLED


def test_fixture_run_again_adds_to_the_log(monkeypatch) -> None:
    """A resume is a new run of Phase 1, so the log holds both attempts.

    The client reads the events of the last attempt. It finds them by the last
    start of the first node, so the events of the earlier attempt stay in the log
    and do not show on the screen.
    """
    fake = FakeStore()
    install(monkeypatch, fake)
    seed(fake)

    start()
    first = len(fake.events)
    start()

    assert len(fake.events) == first * 2
    starts = [
        index
        for index, event in enumerate(fake.events)
        if event["node"] == GRAPH_NODES[0] and event["state"] == RunEventState.STARTED
    ]
    assert len(starts) == 2