"""
Shared FastAPI dependencies — import from here in all routers.
Keeps get_current_user and role guards in one place.
"""
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .security import decode_access_token

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(401, "Authentication required. Please log in.")
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = int(payload.get("sub", ""))
    except (jwt.PyJWTError, ValueError, TypeError):
        raise HTTPException(401, "Your session is invalid or expired. Please log in again.")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(401, "Account not found.")
    if user.account_status == "revoked":
        raise HTTPException(403, "Access to this account has been revoked.")
    return user


def require_active(user: User = Depends(get_current_user)) -> User:
    """Requires authenticated + active (not pending/rejected)."""
    if user.account_status != "active":
        raise HTTPException(403, "Your account is pending approval or has been suspended.")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin" or user.account_status != "active":
        raise HTTPException(403, "Administrator access required.")
    return user


def require_authority(user: User = Depends(get_current_user)) -> User:
    """Water authority official or admin, approved."""
    if user.role not in ("water_authority", "admin") or user.account_status != "active":
        raise HTTPException(403, "Water authority access required.")
    return user


def require_inspector(user: User = Depends(get_current_user)) -> User:
    if user.role != "field_inspector" or user.account_status != "active":
        raise HTTPException(403, "Only approved field inspectors may perform this action.")
    return user


def require_reporter(user: User = Depends(get_current_user)) -> User:
    """Citizens and approved field inspectors can submit reports."""
    if user.account_status != "active":
        raise HTTPException(403, "Your account is pending approval.")
    if user.role not in ("citizen", "field_inspector", "admin"):
        raise HTTPException(403, "You do not have permission to submit reports.")
    return user
