from app.core.config import settings
from sqlalchemy import MetaData, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

engine = create_engine(settings.DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Tell SQLAlchemy all tables belong to 'rostra' schema
meta = MetaData(schema="rostra")
Base = declarative_base(metadata=meta)


def get_db():
    """Dependency function for endpoints"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
