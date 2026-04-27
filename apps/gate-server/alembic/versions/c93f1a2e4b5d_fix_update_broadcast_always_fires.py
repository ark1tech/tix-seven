"""fix update broadcast always fires

Revision ID: c93f1a2e4b5d
Revises: b62c2405140e
Create Date: 2026-04-27 21:05:00.000000

Problem
-------
The NOT FOUND guard added in b62c2405140e prevents broadcasting when the
event_ticket_link join returns no row.  This is correct for INSERT (the link
row might not be visible yet), but it incorrectly silences UPDATE events
(e.g. status → USED after a scan) because if `link_id` is somehow NULL on
the ticket row the join will also return NOT FOUND and the broadcast is
dropped, leaving the TicketTable component stale.

Fix
---
Differentiate INSERT and UPDATE paths:
  - INSERT: keep the NOT FOUND guard — skip broadcast if link_hash is
    unavailable (belt-and-suspenders against the race).
  - UPDATE: always broadcast.  Use the join result for link_hash if
    available, otherwise fall back to null so the frontend's defensive merge
    (link_hash ?? existing.link_hash) still handles it gracefully.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c93f1a2e4b5d'
down_revision: Union[str, Sequence[str], None] = 'b62c2405140e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Split the NOT FOUND guard: INSERT keeps it, UPDATE always broadcasts."""
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
            false   -- public channel
        );

        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    """)


def downgrade() -> None:
    """Restore the b62c2405140e version (NOT FOUND guard for all ops)."""
    op.execute("""
    CREATE OR REPLACE FUNCTION broadcast_enriched_ticket()
    RETURNS TRIGGER AS $$
    DECLARE
        v_link_hash varchar;
        v_payload   jsonb;
    BEGIN
        SELECT link_hash INTO v_link_hash
        FROM event_ticket_link
        WHERE link_id = NEW.link_id;

        IF NOT FOUND OR v_link_hash IS NULL THEN
            RETURN NEW;
        END IF;

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
            false
        );

        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    """)
