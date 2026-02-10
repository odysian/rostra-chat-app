from datetime import UTC, datetime, timedelta

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from jose import JWTError, jwt

from app.core.config import settings

# Argon2id (default) is the PHC winner; memory-hard and resistant to GPU attacks
_ph = PasswordHasher()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against Argon2 hash."""
    try:
        _ph.verify(hashed_password, plain_password)
        return True
    except (VerifyMismatchError, Exception):
        return False


def get_password_hash(password: str) -> str:
    """Hash plain password with Argon2id."""
    return _ph.hash(password)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """
    Create a JWT access token.

    Args:
        data: Dict to encode in the token
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({"exp": expire})
    encoded_jwt: str = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )

    return encoded_jwt


def decode_access_token(token: str) -> str | None:
    """
    Decode a JWT token and extract the subject (user ID).

    Args:
        token: JWT token string

    Returns:
        User ID from token, or None if invalid
    """
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_id: str = payload.get("sub")  # type: ignore
        return user_id
    except JWTError:
        return None
