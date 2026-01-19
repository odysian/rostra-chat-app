from app.core.config import settings
from sqlalchemy import create_engine, event, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

engine = create_engine(settings.DATABASE_URL)


@event.listens_for(engine, "connect", insert=True)
def set_search_path(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("SET search_path TO rostra")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency function for endpoints"""

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
