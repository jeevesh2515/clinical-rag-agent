"""Authentication & user profile routes.

Replaces the previous in-memory ``USERS_DB``. User accounts live in SQLite
(via ``app.db``) so they survive restarts and work across multiple workers.

Roles
-----
A new account is created with a single role chosen at registration time —
either ``patient`` or ``clinician``. The chosen role is also the user's
``primary_role`` and is what gates clinician-only endpoints. The JWT carries
the role so it can be enforced at the dependency layer without a DB lookup on
every request.
"""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.auth.models import (
    LoginUser,
    RegisterUser,
    Token,
    User as UserModel,
    UserInDB,
    UserRole,
    UserUpdate,
)
from app.auth.security import (
    create_access_token,
    decode_access_token,
    get_password_hash,
    verify_password,
)
from app.db import User as OrmUser
from app.db import get_db
from app.core.rate_limiter import limiter

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _to_user_model(user: OrmUser) -> UserInDB:
    """Map an ORM ``User`` row to the public ``UserInDB`` Pydantic model."""
    valid_roles = {r.value for r in UserRole}
    return UserInDB(
        id=user.id,
        username=user.username,
        email=user.email,
        hashed_password=user.hashed_password,
        roles=[UserRole(r) for r in user.roles if r in valid_roles],
        is_active=user.is_active,
        full_name=user.full_name,
        primary_role=user.primary_role,
        date_of_birth=user.date_of_birth,
        notes=user.notes,
        created_at=user.created_at.isoformat() if user.created_at else None,
    )


def get_user_by_username(db: Session, username: str) -> OrmUser | None:
    return db.query(OrmUser).filter(OrmUser.username == username).one_or_none()


def get_user_by_id(db: Session, user_id: str) -> OrmUser | None:
    return db.query(OrmUser).filter(OrmUser.id == user_id).one_or_none()


def authenticate_user(db: Session, username: str, password: str) -> OrmUser | None:
    user = get_user_by_username(db, username)
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


# ─── Dependencies ─────────────────────────────────────────────────────────────


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> OrmUser:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    user_id = payload.get("uid")
    if user_id:
        user = get_user_by_id(db, user_id)
        if user:
            return user
    # Backward-compat: legacy tokens used "sub" = username.
    username = payload.get("sub")
    if username:
        user = get_user_by_username(db, username)
        if user:
            return user
    raise credentials_exception


async def get_current_active_user(current_user: OrmUser = Depends(get_current_user)) -> OrmUser:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


async def get_current_active_clinician(
    current_user: OrmUser = Depends(get_current_active_user),
) -> OrmUser:
    if current_user.primary_role != UserRole.clinician.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Clinician role required"
        )
    return current_user


# ─── Routes ───────────────────────────────────────────────────────────────────


@router.post("/register", response_model=UserModel, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/minute")
async def register_user(request: Request, payload: RegisterUser, db: Session = Depends(get_db)) -> UserInDB:
    if get_user_by_username(db, payload.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered"
        )
    if db.query(OrmUser).filter(OrmUser.email == payload.email).one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )

    primary_role = payload.role.value if payload.role else UserRole.patient.value
    new_user = OrmUser(
        id=str(uuid4()),
        username=payload.username,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        roles_json="[]",
        is_active=True,
        full_name=payload.full_name,
        primary_role=primary_role,
    )
    new_user.roles = [primary_role]

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return _to_user_model(new_user)


@router.post("/token", response_model=Token)
@limiter.limit("10/minute")
async def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> dict:
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"uid": user.id, "sub": user.username, "roles": user.roles},
        expires_delta=access_token_expires,
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
async def login_json(request: Request, payload: LoginUser, db: Session = Depends(get_db)) -> dict:
    """JSON-bodied login. Used by the frontend so we don't have to ship form-data."""
    user = authenticate_user(db, payload.username, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"uid": user.id, "sub": user.username, "roles": user.roles},
        expires_delta=access_token_expires,
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/users/me", response_model=UserModel)
async def read_users_me(current_user: OrmUser = Depends(get_current_active_user)) -> UserInDB:
    return _to_user_model(current_user)


@router.put("/users/me", response_model=UserModel)
async def update_profile(
    payload: UserUpdate,
    current_user: OrmUser = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> UserInDB:
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    if payload.date_of_birth is not None:
        current_user.date_of_birth = payload.date_of_birth
    if payload.notes is not None:
        current_user.notes = payload.notes
    if payload.email and payload.email != current_user.email:
        if db.query(OrmUser).filter(OrmUser.email == payload.email).one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )
        current_user.email = payload.email
    db.commit()
    db.refresh(current_user)
    return _to_user_model(current_user)


@router.get("/users/me/clinician", response_model=UserModel)
async def read_users_me_clinician(
    current_user: OrmUser = Depends(get_current_active_clinician),
) -> UserInDB:
    return _to_user_model(current_user)