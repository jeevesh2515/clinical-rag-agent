
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from datetime import timedelta
from typing import List

from app.auth.models import User, UserInDB, Token, RegisterUser, LoginUser, UserRole, TokenData
from app.auth.security import verify_password, get_password_hash, create_access_token, decode_access_token

router = APIRouter()

# In-memory user storage for demonstration purposes
# In a real application, this would be a database
USERS_DB = {}

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

ACCESS_TOKEN_EXPIRE_MINUTES = 30

async def get_user(username: str) -> UserInDB:
    if username in USERS_DB:
        return USERS_DB[username]
    return None

async def authenticate_user(username: str, password: str) -> UserInDB:
    user = await get_user(username)
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    username: str = payload.get("sub")
    if username is None:
        raise credentials_exception
    user = await get_user(username)
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

async def get_current_active_clinician(current_user: User = Depends(get_current_active_user)) -> User:
    if UserRole.clinician not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a clinician")
    return current_user

@router.post("/register", response_model=User, status_code=status.HTTP_201_CREATED)
async def register_user(user_data: RegisterUser):
    if await get_user(user_data.username):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered")
    
    hashed_password = get_password_hash(user_data.password)
    new_user = UserInDB(
        id=str(len(USERS_DB) + 1), # Simple ID generation
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        roles=[UserRole.patient], # Default role
        is_active=True
    )
    USERS_DB[user_data.username] = new_user
    return new_user

@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "roles": [role.value for role in user.roles]},
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user

@router.get("/users/me/clinician", response_model=User)
async def read_users_me_clinician(current_user: User = Depends(get_current_active_clinician)):
    return current_user
