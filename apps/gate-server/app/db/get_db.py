from contextlib import contextmanager

from app.db.session import SessionLocal


@contextmanager
def db_session():
    db = SessionLocal()

    try:
        yield db
    finally:
        try:
            db.close()
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to close database session cleanly: {e}")


def get_db():
    with db_session() as db:
        yield db
