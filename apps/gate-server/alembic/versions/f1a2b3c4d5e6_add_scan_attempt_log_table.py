"""add scan_attempt_log table for full verify audit

Revision ID: f1a2b3c4d5e6
Revises: 09f228d1f329
Create Date: 2026-04-27

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "09f228d1f329"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Reuse existing PostgreSQL enum types (created in initial migration / app deploys).
_log_result = postgresql.ENUM(
    "GRANTED",
    "DENIED",
    "TIMEOUT",
    "ERROR",
    name="log_result",
    create_type=False,
)

_denial_reason = postgresql.ENUM(
    "INVALID_GATE_ID",
    "INVALID_GATE_ASSIGNMENT",
    "IDENTITY_NOT_VERIFIED",
    "LINK_NOT_FOUND",
    "WRONG_EVENT",
    "TICKET_NOT_FOUND",
    "TICKET_ALREADY_USED",
    "SERVER_TIMEOUT",
    "INTERNAL_SERVER_ERROR",
    name="denial_reason",
    create_type=False,
)


def upgrade() -> None:
    # Idempotent: extend denial_reason if DB was created before these labels existed.
    for label in ("INVALID_GATE_ID", "INVALID_GATE_ASSIGNMENT", "WRONG_EVENT"):
        op.execute(
            sa.text(
                f"ALTER TYPE denial_reason ADD VALUE IF NOT EXISTS '{label}'"
            )
        )

    op.create_table(
        "scan_attempt_log",
        sa.Column("attempt_id", sa.UUID(), nullable=False),
        sa.Column(
            "timestamp",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("gate_id_raw", sa.Text(), nullable=False),
        sa.Column("gate_id", sa.UUID(), nullable=True),
        sa.Column("event_id", sa.UUID(), nullable=True),
        sa.Column("assignment_id", sa.UUID(), nullable=True),
        sa.Column("ticket_id", sa.UUID(), nullable=True),
        sa.Column("result", _log_result, nullable=False),
        sa.Column("denial_reason", _denial_reason, nullable=True),
        sa.Column("error_code", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "(result = 'GRANTED') = (denial_reason IS NULL)",
            name="check_scan_attempt_denial_reason_consistency",
        ),
        sa.ForeignKeyConstraint(["assignment_id"], ["gate_assignment.assignment_id"]),
        sa.ForeignKeyConstraint(["event_id"], ["event.event_id"]),
        sa.ForeignKeyConstraint(["gate_id"], ["gate.gate_id"]),
        sa.ForeignKeyConstraint(["ticket_id"], ["ticket.ticket_id"]),
        sa.PrimaryKeyConstraint("attempt_id"),
    )
    op.create_index(
        "ix_scan_attempt_log_timestamp", "scan_attempt_log", ["timestamp"]
    )
    op.create_index("ix_scan_attempt_log_gate_id", "scan_attempt_log", ["gate_id"])
    op.create_index("ix_scan_attempt_log_event_id", "scan_attempt_log", ["event_id"])
    op.create_index(
        "ix_scan_attempt_log_event_gate_time",
        "scan_attempt_log",
        ["event_id", "gate_id", "timestamp"],
    )


def downgrade() -> None:
    op.drop_index("ix_scan_attempt_log_event_gate_time", table_name="scan_attempt_log")
    op.drop_index("ix_scan_attempt_log_event_id", table_name="scan_attempt_log")
    op.drop_index("ix_scan_attempt_log_gate_id", table_name="scan_attempt_log")
    op.drop_index("ix_scan_attempt_log_timestamp", table_name="scan_attempt_log")
    op.drop_table("scan_attempt_log")
