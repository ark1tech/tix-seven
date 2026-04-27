"""add realtime publication for logs and tickets

Revision ID: 03822af3e680
Revises: a7c9e1d2f3b4
Create Date: 2026-04-27 17:42:55.477383

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '03822af3e680'
down_revision: Union[str, Sequence[str], None] = 'a7c9e1d2f3b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("""
    DO $$
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE ticket;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    """)
    op.execute("""
    DO $$
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE log;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("ALTER PUBLICATION supabase_realtime DROP TABLE ticket;")
    op.execute("ALTER PUBLICATION supabase_realtime DROP TABLE log;")
