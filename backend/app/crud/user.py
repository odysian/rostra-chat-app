from app.core.security import get_password_hash
from app.models.user import User
from app.schemas.user import UserCreate
from sqlalchemy.orm import Session


def get_user_by_username(db: Session, username: str):
    """Get a user by username"""
    return db.query(User).filter(User.username == username).first()


def get_user_by_email(db: Session, email: str):
    """Get a user by email"""
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: int):
    """Get a user by ID"""
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, user: UserCreate):
    """
    Create a new user with hashed password.

    Args:
        db: Database session
        user: UserCreate schema with username, email, password

    Returns:
        Created User model instance
    """
    hashed_password = get_password_hash(user.password)
    db_user = User(
        username=user.username, email=user.email, hashed_password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
