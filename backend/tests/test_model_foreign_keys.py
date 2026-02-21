from sqlalchemy import BigInteger
from sqlalchemy.sql import FromClause

from app.models.message import Message
from app.models.room import Room
from app.models.user import User
from app.models.user_room import UserRoom


def _fk_ondelete(table: FromClause, column_name: str) -> str | None:
    for foreign_key in table.foreign_keys:
        if foreign_key.parent.name == column_name:
            return foreign_key.ondelete
    raise AssertionError(f"Foreign key not found for requested column {column_name}")


def test_message_foreign_keys_use_ondelete_cascade() -> None:
    assert _fk_ondelete(Message.__table__, "room_id") == "CASCADE"
    assert _fk_ondelete(Message.__table__, "user_id") == "CASCADE"


def test_room_creator_foreign_key_uses_ondelete_cascade() -> None:
    assert _fk_ondelete(Room.__table__, "created_by") == "CASCADE"


def test_primary_keys_use_bigint() -> None:
    assert isinstance(User.__table__.c.id.type, BigInteger)
    assert isinstance(Room.__table__.c.id.type, BigInteger)
    assert isinstance(Message.__table__.c.id.type, BigInteger)
    assert isinstance(UserRoom.__table__.c.id.type, BigInteger)
