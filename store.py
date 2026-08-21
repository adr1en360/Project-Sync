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
    BulletTag,
    ResumeBullet,
    RuleSource,
    RuleState,
    RunEvent,
    RunEventState,
    SocialDraft,
    SocialPlatform,
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
    payload = transaction.model_dump(mode="json", exclude={"tx_id", "assets"})
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


# --------------------------------------------------------------------------
# Run events — per-node checkpoint log
# --------------------------------------------------------------------------


def append_run_event(
    tx_id: str,
    node: str,
    state: RunEventState,
    *,
    started_at: str | None = None,
    finished_at: str | None = None,
    error: str | None = None,
) -> str:
    """Append one run event to the transaction's events subcollection.

    Returns the event_id.
    """
    event_id = new_id()
    stamp = now_iso()
    payload = {
        "event_id": event_id,
        "tx_id": tx_id,
        "node": node,
        "state": state.value,
        "started_at": started_at or stamp,
        "finished_at": finished_at,
        "error": error,
    }
    client().collection(config.FIRESTORE_TRANSACTIONS).document(tx_id).collection(
        "events"
    ).document(event_id).set(payload)
    return event_id


def run_events(tx_id: str) -> list[RunEvent]:
    """Read all run events for one transaction, ordered by start time."""
    docs = (
        client()
        .collection(config.FIRESTORE_TRANSACTIONS)
        .document(tx_id)
        .collection("events")
        .order_by("started_at")
        .stream()
    )
    return [RunEvent(**(doc.to_dict() or {})) for doc in docs]


def cancel_requested(tx_id: str) -> bool:
    """Check if a transaction has been marked for cooperative cancellation."""
    doc = client().collection(config.FIRESTORE_TRANSACTIONS).document(tx_id).get()
    if not doc.exists:
        return False
    data = doc.to_dict() or {}
    return bool(data.get("cancel_requested"))


def set_cancel_requested(tx_id: str, value: bool = True) -> None:
    """Set the cooperative cancellation flag on a transaction."""
    client().collection(config.FIRESTORE_TRANSACTIONS).document(tx_id).update(
        {"cancel_requested": value}
    )


def list_transactions(
    user_id: str, status: TransactionStatus | None = None, limit: int = 20
) -> list[Transaction]:
    """List transactions for one user, optionally filtered by status.

    Returns newest first. Sorted in Python because Firestore order_by removes
    documents that lack the field.
    """
    query = client().collection(config.FIRESTORE_TRANSACTIONS).where(
        filter=FieldFilter("user_id", "==", user_id)
    )
    if status:
        query = query.where(filter=FieldFilter("status", "==", status.value))
    docs = query.stream()
    rows = [Transaction(tx_id=doc.id, **(doc.to_dict() or {})) for doc in docs]
    rows.sort(key=lambda row: row.created_at or "", reverse=True)
    return rows[:limit]


def sweep_stranded_running(threshold_minutes: int = 10) -> int:
    """Mark rows stranded at RUNNING past the threshold as FAILED_GENERATION.

    Returns the number of rows updated.
    """
    from datetime import datetime, timedelta

    threshold = datetime.now(_dt.UTC) - timedelta(minutes=threshold_minutes)
    threshold_iso = threshold.isoformat()

    docs = (
        client()
        .collection(config.FIRESTORE_TRANSACTIONS)
        .where(filter=FieldFilter("status", "==", TransactionStatus.RUNNING.value))
        .stream()
    )

    count = 0
    for doc in docs:
        data = doc.to_dict() or {}
        created = data.get("created_at")
        if created and created < threshold_iso:
            update_transaction(
                doc.id,
                status=TransactionStatus.FAILED_GENERATION.value,
                error_message="Run stranded — container was recycled mid-flight.",
                completed_at=now_iso(),
            )
            count += 1
    return count


# --------------------------------------------------------------------------
# Stage 4: Bullet Bank
# --------------------------------------------------------------------------


def save_bullet(bullet: ResumeBullet) -> None:
    """Write a bullet to the bullet bank."""
    payload = bullet.model_dump(mode="json", exclude={"bullet_id"})
    client().collection(config.FIRESTORE_RESUME_BULLETS).document(
        bullet.bullet_id
    ).set(payload)


def get_bullet(bullet_id: str) -> ResumeBullet | None:
    """Read one bullet by ID."""
    doc = client().collection(config.FIRESTORE_RESUME_BULLETS).document(bullet_id).get()
    if not doc.exists:
        return None
    return ResumeBullet(bullet_id=doc.id, **(doc.to_dict() or {}))


def update_bullet(bullet_id: str, **fields: Any) -> None:
    """Update fields of a bullet."""
    client().collection(config.FIRESTORE_RESUME_BULLETS).document(bullet_id).update(fields)


def delete_bullet(bullet_id: str) -> None:
    """Delete a bullet from the bank."""
    client().collection(config.FIRESTORE_RESUME_BULLETS).document(bullet_id).delete()


def list_bullets(
    user_id: str,
    project: str | None = None,
    tags: list[BulletTag] | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[ResumeBullet]:
    """List bullets for a user with optional filters.

    Returns newest first. Sorted in Python because Firestore order_by removes
    documents that lack the field.
    """
    query = client().collection(config.FIRESTORE_RESUME_BULLETS).where(
        filter=FieldFilter("user_id", "==", user_id)
    )
    if project:
        query = query.where(filter=FieldFilter("project", "==", project))
    docs = query.stream()
    bullets = [ResumeBullet(bullet_id=doc.id, **(doc.to_dict() or {})) for doc in docs]

    if tags:
        tag_values = [t.value for t in tags]
        bullets = [b for b in bullets if any(tag in b.tags for tag in tag_values)]

    bullets.sort(key=lambda b: b.created_at or "", reverse=True)
    return bullets[offset : offset + limit]


def bullets_exist_for_tx(source_tx_id: str) -> bool:
    """Tell if the bank holds a bullet from this transaction.

    The auto-seed uses this to stop a duplicate. A resume runs Phase 1 again under
    the same transaction id, so a second approval must not write the same bullets
    one more time.
    """
    query = client().collection(config.FIRESTORE_RESUME_BULLETS).where(
        filter=FieldFilter("source_tx_id", "==", source_tx_id)
    )
    # `any` reads only the first document and then stops, so this does not pull the
    # whole set from the database.
    return any(True for _ in query.stream())


def seed_bullets(
    *,
    user_id: str,
    tx_id: str,
    project_name: str,
    resume_bullets: list[str],
) -> int:
    """Write one bullet for each resume line, and give the count.

    Each bullet links to its transaction with `source_tx_id`. The caller decides
    when a seed is safe. This function does not look for a bullet that exists
    already, so the caller must check `bullets_exist_for_tx` first.
    """
    seeded = 0
    for text in resume_bullets:
        bullet = ResumeBullet(
            bullet_id=new_id(),
            user_id=user_id,
            text=text,
            project=project_name,
            source_tx_id=tx_id,
            tags=[],
            created_at=now_iso(),
            is_manual_edit=False,
        )
        save_bullet(bullet)
        seeded += 1
    return seeded


# --------------------------------------------------------------------------
# Stage 4: Social Drafts
# --------------------------------------------------------------------------


def save_social_draft(draft: SocialDraft) -> None:
    """Write a social draft to the drafts collection."""
    payload = draft.model_dump(mode="json", exclude={"draft_id"})
    client().collection(config.FIRESTORE_SOCIAL_DRAFTS).document(
        draft.draft_id
    ).set(payload)


def get_social_draft(draft_id: str) -> SocialDraft | None:
    """Read one social draft by ID."""
    doc = client().collection(config.FIRESTORE_SOCIAL_DRAFTS).document(draft_id).get()
    if not doc.exists:
        return None
    return SocialDraft(draft_id=doc.id, **(doc.to_dict() or {}))


def update_social_draft(draft_id: str, **fields: Any) -> None:
    """Update fields of a social draft."""
    client().collection(config.FIRESTORE_SOCIAL_DRAFTS).document(draft_id).update(fields)


def delete_social_draft(draft_id: str) -> None:
    """Delete a social draft."""
    client().collection(config.FIRESTORE_SOCIAL_DRAFTS).document(draft_id).delete()


def list_social_drafts(
    user_id: str,
    tx_id: str | None = None,
    platform: SocialPlatform | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[SocialDraft]:
    """List social drafts for a user with optional filters.

    Returns newest first. Sorted in Python because Firestore order_by removes
    documents that lack the field.
    """
    query = client().collection(config.FIRESTORE_SOCIAL_DRAFTS).where(
        filter=FieldFilter("user_id", "==", user_id)
    )
    if tx_id:
        query = query.where(filter=FieldFilter("tx_id", "==", tx_id))
    if platform:
        query = query.where(filter=FieldFilter("platform", "==", platform.value))
    docs = query.stream()
    drafts = [SocialDraft(draft_id=doc.id, **(doc.to_dict() or {})) for doc in docs]
    drafts.sort(key=lambda d: d.created_at or "", reverse=True)
    return drafts[offset : offset + limit]
