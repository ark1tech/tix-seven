from contextlib import contextmanager

from app.db.session import SessionLocal


@contextmanager
def db_session():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def get_db():
    with db_session() as db:
        yield db
