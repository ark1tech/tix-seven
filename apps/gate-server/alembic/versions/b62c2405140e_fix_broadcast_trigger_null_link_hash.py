"""fix broadcast trigger null link_hash guard

Revision ID: b62c2405140e
Revises: 3bb0d399074a
Create Date: 2026-04-27 18:27:16.958132

Problem
-------
The broadcast_enriched_ticket() trigger fires AFTER INSERT OR UPDATE ON ticket.
For the INSERT path the trigger joins event_ticket_link to fetch link_hash.
If that join finds no row (e.g. link_id is temporarily NULL, or the join races
with the outer transaction's visibility window), v_link_hash stays NULL and the
broadcast payload carries "link_hash": null.

The frontend receives a null link_hash, cannot call .slice() on it, and crashes
with: TypeError: Cannot read properties of undefined (reading 'slice').

Fix
---
Add a NOT FOUND guard: if the join returns no row, return NEW immediately
without broadcasting.  The frontend defensive guard (link_hash ?? existing) is
a belt-and-suspenders companion fix.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b62c2405140e'
down_revision: Union[str, Sequence[str], None] = '3bb0d399074a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Replace the trigger function with a null-safe version."""
    op.execute("""
    CREATE OR REPLACE FUNCTION broadcast_enriched_ticket()
    RETURNS TRIGGER AS $$
    DECLARE
        v_link_hash varchar;
        v_payload   jsonb;
    BEGIN
        -- Fetch link_hash from the joined table.
        -- On INSERT, event_ticket_link is committed in the same transaction so
        -- this should always find a row.  Guard with NOT FOUND as a safety net:
        -- if the join misses, skip the broadcast rather than emitting null.
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
            false   -- public channel: anon subscribers receive it without RLS policies
        );

        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    """)


def downgrade() -> None:
    """Restore the original trigger function (without the NOT FOUND guard)."""
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
            'ticket:' || NEW.event_id
        );

        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    """)
