"""
In-app notification router.

Notifications are generated:
 - Automatically when a WaterReport is scored at high (≥50) or critical (≥75).
 - For all users with role water_authority, field_inspector, and admin.
 - With deduplication: one notification per (report_id, category) per user.

External email/push can be wired later via the `_send_external` stub.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..database import get_db
from ..models import User, Notification, WaterReport
from ..schemas import NotificationOut, NotificationCount
from ..dependencies import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])

# Alert threshold — score at or above this triggers a notification
HIGH_RISK_THRESHOLD = 50.0


def _send_external(notification: Notification):
    """Stub for future email/push integration. No-op in phase 1."""
    pass


def maybe_create_alerts(db: Session, report: WaterReport):
    """
    Called after a report is scored.  Creates in-app notifications for
    water_authority, field_inspector, and admin users when risk is high/critical.
    Citizens are NOT notified about other users' reports.
    Deduplication prevents duplicate rows for the same event.
    """
    if report.risk_score is None or report.risk_score < HIGH_RISK_THRESHOLD:
        return

    category = "critical" if report.risk_score >= 75 else "warning"
    title = (
        f"⚠ Critical water risk — Report #{report.id}"
        if category == "critical"
        else f"High risk report — Report #{report.id}"
    )
    message = (
        f"A {'critical' if category == 'critical' else 'high'}-risk water-quality observation "
        f"(score {report.risk_score}/100) has been submitted for a "
        f"{report.source_type.replace('_', ' ')} source. "
        f"Preliminary category: {report.risk_category}. "
        f"This is a preliminary screening alert — laboratory confirmation is required."
    )

    # Notify all privileged users
    officials = list(db.scalars(
        select(User).where(
            User.role.in_(["water_authority", "field_inspector", "admin"]),
            User.account_status == "active",
        )
    ))

    for user in officials:
        dedup_key = f"report_{report.id}_{category}_user_{user.id}"
        existing = db.scalar(
            select(Notification).where(Notification.dedup_key == dedup_key)
        )
        if existing:
            continue
        notif = Notification(
            user_id=user.id,
            report_id=report.id,
            title=title,
            message=message,
            category=category,
            dedup_key=dedup_key,
        )
        db.add(notif)
        _send_external(notif)

    db.commit()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[NotificationOut])
def list_notifications(
    unread_only: bool = False,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    if unread_only:
        q = q.where(Notification.is_read == False)
    return list(db.scalars(q))


@router.get("/count", response_model=NotificationCount)
def notification_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import func
    total = db.scalar(
        select(func.count()).select_from(Notification)
        .where(Notification.user_id == current_user.id)
    ) or 0
    unread = db.scalar(
        select(func.count()).select_from(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)
    ) or 0
    return NotificationCount(unread=unread, total=total)


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notif = db.get(Notification, notification_id)
    if not notif or notif.user_id != current_user.id:
        raise HTTPException(404, "Notification not found.")
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif


@router.post("/read-all", status_code=204)
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
