"""use PHT wall-clock defaults for operational timestamps

Revision ID: a7c9e1d2f3b4
Revises: f1a2b3c4d5e6
Create Date: 2026-04-27

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a7c9e1d2f3b4"
down_revision: Union[str, Sequence[str], None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_PHT_NOW = sa.text("timezone('Asia/Manila', now())")
_UTC_NOW = sa.text("now()")


def upgrade() -> None:
    """Store generated timestamp-without-time-zone values as Philippine wall clock."""
    op.alter_column("ticket", "created_at", server_default=_PHT_NOW)
    op.alter_column("log", "timestamp", server_default=_PHT_NOW)
    op.alter_column("scan_attempt_log", "timestamp", server_default=_PHT_NOW)


def downgrade() -> None:
    """Restore previous UTC-session defaults."""
    op.alter_column("scan_attempt_log", "timestamp", server_default=_UTC_NOW)
    op.alter_column("log", "timestamp", server_default=_UTC_NOW)
    op.alter_column("ticket", "created_at", server_default=_UTC_NOW)
