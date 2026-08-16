"""The Firestore layer. All reads and writes of state pass through this module.

Firestore holds two things. The transaction rows are the episodic memory. The
style rules are the semantic memory.

Three points about Firestore control the queries here:

* `order_by` removes a document that does not have the field. Do not order by a
  field that an old document can be without.
* If a query has an inequality filter, the same field must be first in the
  order.
* Use `FieldFilter`. A `where()` call with three positional arguments is
  deprecated.
"""

from __future__ import annotations

import datetime as _dt
import uuid
from functools import lru_cache
from typing import Any

from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

import config
from models import (
    RuleSource,
    RuleState,
    StyleRule,
    Transaction,
    TransactionStatus,
)


@lru_cache(maxsize=1)
def client() -> firestore.Client:
    """Give the Firestore client. The client is made one time and kept.

    A new client for each request costs a connection each time. `lru_cache` holds
    the one client, so the module needs no global variable.
    """
    if config.GOOGLE_CLOUD_PROJECT:
        return firestore.Client(project=config.GOOGLE_CLOUD_PROJECT)
    return firestore.Client()


def now_iso() -> str:
    """Give the time now, in UTC, as an ISO 8601 string."""
    return _dt.datetime.now(_dt.UTC).isoformat()


def new_id() -> str:
    """Give a new unique identifier."""
    return uuid.uuid4().hex


# --------------------------------------------------------------------------
# Style rules — the semantic memory
# --------------------------------------------------------------------------


def active_style_rules(user_id: str) -> list[StyleRule]:
    """Read the ACTIVE rules of one person.

    Every run reads the rules new. The rules are never held in a cache. So a
    person who turns a rule on or off changes the next generation, with no new
    deploy and no restart of the service.

    The query does not order the result in the database, because `order_by`
    removes a document that has no `created_at` field. The sort happens in
    Python instead.
    """
    docs = (
        client()
        .collection(config.FIRESTORE_STYLE_RULES)
        .where(filter=FieldFilter("user_id", "==", user_id))
        .where(filter=FieldFilter("state", "==", RuleState.ACTIVE.value))
        .stream()
    )
    rules = [_rule_from_doc(doc) for doc in docs]
    rules.sort(key=lambda rule: rule.created_at or "")
    return rules


def all_style_rules(user_id: str) -> list[StyleRule]:
    """Read the rules of one person, except the rules that the person deleted.

    The test of the state is in Python, and not in the query. A `!=` test in
    Firestore is an inequality filter. Such a filter must be first in the order,
    and it can need a composite index. It also removes a document that has no
    `state` field. A test in Python has none of those costs, and the sort of this
    function is already in Python.
    """
    docs = (
        client()
        .collection(config.FIRESTORE_STYLE_RULES)
        .where(filter=FieldFilter("user_id", "==", user_id))
        .stream()
    )
    rules = [_rule_from_doc(doc) for doc in docs]
    rules = [rule for rule in rules if rule.state != RuleState.DELETED]
    rules.sort(key=lambda rule: rule.created_at or "")
    return rules


def _rule_from_doc(doc: Any) -> StyleRule:
    """Make a `StyleRule` from a Firestore document."""
    data = doc.to_dict() or {}
    return StyleRule(
        rule_id=doc.id,
        text=data.get("text", ""),
        state=RuleState(data.get("state", RuleState.PROPOSED.value)),
        source=RuleSource(data.get("source", RuleSource.CURATOR.value)),
        source_transaction_id=data.get("source_transaction_id"),
        created_at=data.get("created_at"),
        updated_at=data.get("updated_at"),
    )


def write_style_rule(
    user_id: str,
    text: str,
    source: RuleSource = RuleSource.CURATOR,
    source_transaction_id: str | None = None,
) -> StyleRule:
    """Write one new rule in the `PROPOSED` state.

    A new rule is always `PROPOSED`. Nothing becomes `ACTIVE` without one click
    from a person. The tone of the user can change between projects, so a rule
    from one project must not bind every later project without a check.
    """
    rule_id = new_id()
    stamp = now_iso()
    payload = {
        "user_id": user_id,
        "text": text,
        "state": RuleState.PROPOSED.value,
        "source": source.value,
        "source_transaction_id": source_transaction_id,
        "created_at": stamp,
        "updated_at": stamp,
    }
    client().collection(config.FIRESTORE_STYLE_RULES).document(rule_id).set(payload)
    return StyleRule(rule_id=rule_id, **{k: v for k, v in payload.items() if k != "user_id"})


def set_rule_state(rule_id: str, state: RuleState) -> None:
    """Change the state of one rule.

    A rule that a person dismisses becomes `INACTIVE`. The rule is not deleted,
    so the person can make it active again from a list later.
    """
    client().collection(config.FIRESTORE_STYLE_RULES).document(rule_id).update(
        {"state": state.value, "updated_at": now_iso()}
    )


def delete_style_rule(rule_id: str) -> None:
    """Hide one rule from the list of rules.

    The state becomes `DELETED`. The document is not removed. Two things need
    the document: a transaction row names the rules that made its draft, and the
    corpus of past rules teaches the curator the voice of the person.
    """
    client().collection(config.FIRESTORE_STYLE_RULES).document(rule_id).update(
        {"state": RuleState.DELETED.value, "updated_at": now_iso()}
    )


# --------------------------------------------------------------------------
# Transactions — the episodic memory
# --------------------------------------------------------------------------


def save_transaction(transaction: Transaction) -> None:
    """Write a full transaction row."""
    payload = transaction.model_dump(mode="json", exclude={"tx_id"})
    client().collection(config.FIRESTORE_TRANSACTIONS).document(
        transaction.tx_id
    ).set(payload)


def get_transaction(tx_id: str) -> Transaction | None:
    """Read one transaction row. The result is `None` if the row is absent."""
    doc = client().collection(config.FIRESTORE_TRANSACTIONS).document(tx_id).get()
    if not doc.exists:
        return None
    return Transaction(tx_id=doc.id, **(doc.to_dict() or {}))


def update_transaction(tx_id: str, **fields: Any) -> None:
    """Change some fields of one transaction row."""
    client().collection(config.FIRESTORE_TRANSACTIONS).document(tx_id).update(fields)


def fail_transaction(tx_id: str, status: TransactionStatus, message: str) -> None:
    """Mark a transaction as failed, and keep the reason.

    No step fails quietly. Each step writes its state before it fails, so a
    retry starts at that step and does not run the whole pipeline again.
    """
    update_transaction(
        tx_id,
        status=status.value,
        error_message=message[:1000],
        completed_at=now_iso(),
    )


def recent_completed_transactions(user_id: str, limit: int = 10) -> list[Transaction]:
    """Read the most recent completed rows of one person.

    The rule curator reads these rows to find a pattern across projects. This is
    a plain query by recency. There is no vector search and no semantic index.
    """
    docs = (
        client()
        .collection(config.FIRESTORE_TRANSACTIONS)
        .where(filter=FieldFilter("user_id", "==", user_id))
        .where(filter=FieldFilter("status", "==", TransactionStatus.COMPLETED.value))
        .stream()
    )
    rows = [Transaction(tx_id=doc.id, **(doc.to_dict() or {})) for doc in docs]
    rows.sort(key=lambda row: row.created_at or "", reverse=True)
    return rows[:limit]
