import pytest
from pydantic import ValidationError

from app.schemas.user import UserLogin


def test_user_login_rejects_username_longer_than_50_chars():
    with pytest.raises(ValidationError):
        UserLogin(username="u" * 51, password="valid-password")


def test_user_login_rejects_password_longer_than_50_chars():
    with pytest.raises(ValidationError):
        UserLogin(username="valid-user", password="p" * 51)
