
from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum

class UserRole(str, Enum):
    clinician = "clinician"
    patient = "patient"
    admin = "admin"
    care_coordinator = "care_coordinator"

class User(BaseModel):
    id: str = Field(..., description="Unique identifier for the user")
    username: str = Field(..., description="Username for login")
    email: str = Field(..., description="User's email address")
    hashed_password: str = Field(..., description="Hashed password for security")
    roles: List[UserRole] = Field(default_factory=list, description="List of roles assigned to the user")
    is_active: bool = Field(True, description="Whether the user account is active")

class UserInDB(User):
    # This model can be extended with database-specific fields if needed
    pass

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    username: Optional[str] = None

class RegisterUser(BaseModel):
    username: str = Field(..., description="Desired username")
    email: str = Field(..., description="User's email address")
    password: str = Field(..., description="Desired password")

class LoginUser(BaseModel):
    username: str = Field(..., description="Username for login")
    password: str = Field(..., description="Password for login")
