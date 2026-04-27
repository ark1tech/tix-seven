"""add ticket broadcast trigger

Revision ID: 3bb0d399074a
Revises: 03822af3e680
Create Date: 2026-04-27 18:08:54.466116

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3bb0d399074a'
down_revision: Union[str, Sequence[str], None] = '03822af3e680'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("""
    CREATE OR REPLACE FUNCTION broadcast_enriched_ticket()
    RETURNS TRIGGER AS $$
    DECLARE
        v_link_hash varchar;
        v_payload jsonb;
    BEGIN
        SELECT link_hash INTO v_link_hash
        FROM event_ticket_link
        WHERE link_id = NEW.link_id;

        v_payload := jsonb_build_object(
            'ticket_id', NEW.ticket_id,
            'link_id', NEW.link_id,
            'link_hash', v_link_hash,
            'event_id', NEW.event_id,
            'status', NEW.status,
            'created_at', NEW.created_at,
            'used_at', NEW.used_at
        );

        PERFORM realtime.send(
            v_payload,
            'ticket_update',
            'ticket:' || NEW.event_id
        );

        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    """)

    op.execute("""
    CREATE TRIGGER ticket_broadcast_trigger
    AFTER INSERT OR UPDATE ON ticket
    FOR EACH ROW EXECUTE FUNCTION broadcast_enriched_ticket();
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP TRIGGER IF EXISTS ticket_broadcast_trigger ON ticket;")
    op.execute("DROP FUNCTION IF EXISTS broadcast_enriched_ticket();")
