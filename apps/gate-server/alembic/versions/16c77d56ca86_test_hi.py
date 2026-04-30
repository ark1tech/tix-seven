"""add broadcast triggers

Revision ID: d2e3f4g5h6i7
Revises: <placeholder>
Create Date: 2026-04-27 21:15:00.000000

Summary
-------
Adds realtime broadcast triggers for the `ticket` and `log` tables using
Supabase's `realtime.send()` API, bypassing RLS so that `anon` dashboard
viewers receive updates without needing an `authenticated` role.

Ticket trigger (broadcast_enriched_ticket)
------------------------------------------
Fires AFTER INSERT OR UPDATE on `ticket`.  Joins `event_ticket_link` to
enrich the payload with `link_hash`.

  - INSERT: skips broadcast if the join returns no row or a null link_hash
    (guards against a race with the outer transaction's visibility window,
    which would otherwise emit a null link_hash and crash the frontend's
    `.slice()` call).
  - UPDATE: always broadcasts.  link_hash may be null, but the frontend
    merge guard (`link_hash ?? existing.link_hash`) handles it gracefully.

Publishes to topic: `ticket:<event_id>`, event type: `ticket_update`.

Log trigger (broadcast_log)
---------------------------
Fires AFTER INSERT on `log`.  Publishes scan results directly (no join
needed) to topic: `log:<event_id>`, event type: `log_insert`.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '16c77d56ca86'
down_revision: Union[str, Sequence[str], None] = '52f9f6453b6b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add ticket and log broadcast triggers."""

    # ------------------------------------------------------------------
    # Ticket broadcast trigger
    # ------------------------------------------------------------------
    op.execute("""
    CREATE OR REPLACE FUNCTION broadcast_enriched_ticket()
    RETURNS TRIGGER AS $$
    DECLARE
        v_link_hash varchar;
        v_payload   jsonb;
    BEGIN
        -- Always attempt to fetch link_hash from the join table.
        SELECT link_hash INTO v_link_hash
        FROM event_ticket_link
        WHERE link_id = NEW.link_id;

        IF TG_OP = 'INSERT' THEN
            -- On INSERT the link row is committed in the same transaction.
            -- If the join misses (race or null link_id) skip the broadcast
            -- rather than emitting a null link_hash that would crash the
            -- frontend's .slice() call.
            IF NOT FOUND OR v_link_hash IS NULL THEN
                RETURN NEW;
            END IF;
        END IF;

        -- For UPDATE (e.g. status → USED after a scan) always broadcast.
        -- link_hash may be null here but the frontend merge guard handles it:
        --   link_hash: updatedTicket.link_hash ?? existing.link_hash
        v_payload := jsonb_build_object(
            'ticket_id',  NEW.ticket_id,
            'link_id',    NEW.link_id,
            'link_hash',  v_link_hash,
            'event_id',   NEW.event_id,
            'status',     NEW.status,
            'created_at', NEW.created_at,
            'used_at',    NEW.used_at
        );

        PERFORM realtime.send(
            v_payload,
            'ticket_update',
            'ticket:' || NEW.event_id,
            false   -- public channel: anon subscribers receive it without RLS
        );

        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    """)

    op.execute("""
    DROP TRIGGER IF EXISTS ticket_broadcast_trigger ON ticket;
    CREATE TRIGGER ticket_broadcast_trigger
    AFTER INSERT OR UPDATE ON ticket
    FOR EACH ROW EXECUTE FUNCTION broadcast_enriched_ticket();
    """)

    # ------------------------------------------------------------------
    # Log broadcast trigger
    # ------------------------------------------------------------------
    op.execute("""
    CREATE OR REPLACE FUNCTION broadcast_log()
    RETURNS TRIGGER AS $$
    DECLARE
        v_payload jsonb;
    BEGIN
        v_payload := jsonb_build_object(
            'log_id',        NEW.log_id,
            'event_id',      NEW.event_id,
            'gate_id',       NEW.gate_id,
            'assignment_id', NEW.assignment_id,
            'ticket_id',     NEW.ticket_id,
            'result',        NEW.result,
            'denial_reason', NEW.denial_reason,
            'timestamp',     NEW.timestamp
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
    """Remove ticket and log broadcast triggers."""
    op.execute("DROP TRIGGER IF EXISTS log_broadcast_trigger ON log;")
    op.execute("DROP FUNCTION IF EXISTS broadcast_log();")

    op.execute("DROP TRIGGER IF EXISTS ticket_broadcast_trigger ON ticket;")
    op.execute("DROP FUNCTION IF EXISTS broadcast_enriched_ticket();")
