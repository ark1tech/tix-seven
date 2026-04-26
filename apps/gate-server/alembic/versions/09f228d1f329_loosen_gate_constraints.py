"""loosen log denial_reason check constraint

Revision ID: 09f228d1f329
Revises: d55bb1354961
Create Date: 2026-04-23 10:36:57.186813

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "09f228d1f329"
down_revision: Union[str, Sequence[str], None] = "d55bb1354961"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint(
        "check_denial_reason_consistency",
        "log",
        type_="check",
    )

    op.create_check_constraint(
        "check_denial_reason_consistency",
        "log",
        "(result = 'GRANTED') = (denial_reason IS NULL)",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        "check_denial_reason_consistency",
        "log",
        type_="check",
    )

    op.create_check_constraint(
        "check_denial_reason_consistency",
        "log",
        "(result = 'DENIED') = (denial_reason IS NOT NULL)",
    )
