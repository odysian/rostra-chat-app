from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.models.user import User
from app.schemas.user import UserCreate


async def get_user_by_username(db: AsyncSession, username: str):
    """Get a user by username"""
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def get_user_by_email(db: AsyncSession, email: str):
    """Get a user by email (case-insensitive lookup)"""
    normalized_email = email.lower().strip()
    result = await db.execute(select(User).where(User.email == normalized_email))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: int) -> User | None:
    """Get a user by ID"""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, user: UserCreate):
    """
    Create a new user with hashed password.

    Args:
        db: Async database session
        user: UserCreate schema with username, email, password

    Returns:
        Created User model instance
    """
    hashed_password = get_password_hash(user.password)
    normalized_email = user.email.lower().strip()
    db_user = User(
        username=user.username, email=normalized_email, hashed_password=hashed_password
    )
    db.add(db_user)  # No await — add() just registers the object, no I/O
    await db.commit()
    await db.refresh(db_user)
    return db_user
