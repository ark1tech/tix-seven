"""add log broadcast trigger

Revision ID: d2e3f4g5h6i7
Revises: c93f1a2e4b5d
Create Date: 2026-04-27 21:15:00.000000

Problem
-------
Entry logs currently rely on `postgres_changes`.  Since the `log` table has
RLS restricted to `authenticated` users, `anon` dashboard viewers (common
in local development or simple setups) do not receive realtime updates.

Fix
---
Implement a broadcast trigger for the `log` table, similar to the `ticket`
table. This allows public broadcasting of scan results to the `log:<event_id>`
topic, bypassing RLS for the realtime stream and ensuring consistency
across all realtime components.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd2e3f4g5h6i7'
down_revision: Union[str, Sequence[str], None] = 'c93f1a2e4b5d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add log broadcast trigger."""
    op.execute("""
    CREATE OR REPLACE FUNCTION broadcast_log()
    RETURNS TRIGGER AS $$
    DECLARE
        v_payload jsonb;
    BEGIN
        v_payload := jsonb_build_object(
            'log_id', NEW.log_id,
            'event_id', NEW.event_id,
            'gate_id', NEW.gate_id,
            'assignment_id', NEW.assignment_id,
            'ticket_id', NEW.ticket_id,
            'result', NEW.result,
            'denial_reason', NEW.denial_reason,
            'timestamp', NEW.timestamp
        );

        PERFORM realtime.send(
            v_payload,
            'log_insert',
            'log:' || NEW.event_id,
            false   -- public channel
        );

        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    """)

    op.execute("""
    DROP TRIGGER IF EXISTS log_broadcast_trigger ON log;
    CREATE TRIGGER log_broadcast_trigger
    AFTER INSERT ON log
    FOR EACH ROW EXECUTE FUNCTION broadcast_log();
    """)


def downgrade() -> None:    
    """Remove log broadcast trigger."""
    op.execute("DROP TRIGGER IF EXISTS log_broadcast_trigger ON log;")
    op.execute("DROP FUNCTION IF EXISTS broadcast_log();")
