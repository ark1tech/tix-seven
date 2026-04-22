"""add_grant_deny_to_log_result

Revision ID: de9a8605a193
Revises: 529057d8a053
Create Date: 2026-04-22 14:48:12.480957

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "de9a8605a193"
down_revision: Union[str, Sequence[str], None] = "529057d8a053"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE log_result ADD VALUE IF NOT EXISTS 'DENY'")
        op.execute("ALTER TYPE log_result ADD VALUE IF NOT EXISTS 'GRANT'")


def downgrade() -> None:
    """Downgrade schema."""
    pass
