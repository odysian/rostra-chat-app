from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.security import create_access_token, verify_password
from app.crud import user as user_crud
from app.models.user import User
from app.schemas.user import Token, UserCreate, UserLogin, UserResponse
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
@limiter.limit("5/minute")
async def register(request: Request, user: UserCreate, db: AsyncSession = Depends(get_db)):
    """
    Register a new user.

    - Checks if username or email already exists
    - Hashes password before storing
    - Returns created user (without password)
    """
    db_user = await user_crud.get_user_by_username(db, user.username)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )

    db_user = await user_crud.get_user_by_email(db, user.email)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )

    return await user_crud.create_user(db, user)


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
async def login(request: Request, user: UserLogin, db: AsyncSession = Depends(get_db)):
    """
    Login with username and password.

    - Verifies credentials
    - Returns JWT access token
    """
    db_user = await user_crud.get_user_by_username(db, user.username)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    # verify_password is CPU-only (argon2 hash comparison), no await needed
    if not verify_password(user.password, db_user.hashed_password):  # type: ignore
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    # create_access_token is CPU-only (JWT signing), no await needed
    access_token = create_access_token(data={"sub": str(db_user.id)})

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    Get current user information.

    Requires authentication (JWT token in Authorization header).
    """
    return current_user
