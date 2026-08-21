"""Bullet Bank endpoints.

The bullet bank stores resume bullets across projects. Bullets can be auto-seeded
from approved transactions or created manually. Each bullet has tags for
filtering and a source transaction link for context.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

import store
from models import (
    BulletCreateRequest,
    BulletTag,
    BulletUpdateRequest,
    ResumeBullet,
)

router = APIRouter(prefix="/api/v1", tags=["bullets"])


@router.post("/bullets")
async def create_bullet(request: BulletCreateRequest) -> dict:
    """Create a new bullet in the bank."""
    bullet_id = store.new_id()
    bullet = ResumeBullet(
        bullet_id=bullet_id,
        user_id=request.user_id,
        text=request.text,
        project=request.project,
        source_tx_id=request.source_tx_id,
        tags=request.tags,
        created_at=store.now_iso(),
        is_manual_edit=True,
    )
    store.save_bullet(bullet)
    return bullet.model_dump(mode="json")


@router.get("/bullets")
async def list_bullets(
    user_id: str = Query("default"),
    project: str | None = Query(None),
    tags: list[BulletTag] | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> list[dict]:
    """List bullets for a user with optional filters."""
    bullets = store.list_bullets(
        user_id=user_id,
        project=project,
        tags=tags,
        limit=limit,
        offset=offset,
    )
    return [b.model_dump(mode="json") for b in bullets]


@router.get("/bullets/{bullet_id}")
async def get_bullet(bullet_id: str) -> dict:
    """Get a single bullet by ID."""
    bullet = store.get_bullet(bullet_id)
    if bullet is None:
        raise HTTPException(status_code=404, detail="No such bullet.")
    return bullet.model_dump(mode="json")


@router.patch("/bullets/{bullet_id}")
async def update_bullet(bullet_id: str, request: BulletUpdateRequest) -> dict:
    """Update a bullet."""
    bullet = store.get_bullet(bullet_id)
    if bullet is None:
        raise HTTPException(status_code=404, detail="No such bullet.")

    update_fields = {}
    if request.text is not None:
        update_fields["text"] = request.text
    if request.tags is not None:
        update_fields["tags"] = [t.value for t in request.tags]
    if request.project is not None:
        update_fields["project"] = request.project

    if update_fields:
        update_fields["is_manual_edit"] = True
        store.update_bullet(bullet_id, **update_fields)

    updated = store.get_bullet(bullet_id)
    return updated.model_dump(mode="json")


@router.delete("/bullets/{bullet_id}")
async def delete_bullet(bullet_id: str) -> dict:
    """Delete a bullet."""
    bullet = store.get_bullet(bullet_id)
    if bullet is None:
        raise HTTPException(status_code=404, detail="No such bullet.")
    store.delete_bullet(bullet_id)
    return {"status": "deleted", "bullet_id": bullet_id}


@router.post("/bullets/seed-from-transaction/{tx_id}")
async def seed_bullets_from_transaction(tx_id: str) -> dict:
    """Seed the bullet bank from an approved transaction's resume bullets."""
    transaction = store.get_transaction(tx_id)
    if transaction is None:
        raise HTTPException(status_code=404, detail="No such transaction.")

    if transaction.status != "COMPLETED":
        raise HTTPException(
            status_code=409,
            detail="Can only seed bullets from a COMPLETED transaction.",
        )

    assets = transaction.assets
    if not assets or not assets.resume_bullets:
        return {"seeded": 0, "message": "No resume bullets in this transaction."}

    # A resume runs the graph again under the same transaction id. Without this
    # guard, a second seed would write the same bullets one more time. A person who
    # deletes every bullet of a project and seeds again gets a fresh set, which is a
    # refill and not a duplicate.
    if store.bullets_exist_for_tx(tx_id):
        return {
            "seeded": 0,
            "message": "The bank already holds bullets from this transaction.",
        }

    project_name = transaction.metadata.project_name if transaction.metadata else "Unknown Project"
    seeded = store.seed_bullets(
        user_id=transaction.user_id,
        tx_id=tx_id,
        project_name=project_name,
        resume_bullets=assets.resume_bullets,
    )
    return {"seeded": seeded, "project": project_name}