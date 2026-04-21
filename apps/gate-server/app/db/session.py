from sqlalchemy import create_engine

from sqlalchemy.orm import sessionmaker

from app.core.config import settings

assert settings.supabase_url is not None, "Missing Supabase URL in .env."

engine = create_engine(settings.supabase_url, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()
