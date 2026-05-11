import datetime
import uuid

from app.db.session import SessionLocal
from app.models.enums import (
    AssignmentStatusEnum,
    EventStatusEnum,
    GateStatusEnum,
    TicketStatusEnum,
)
from app.models.event import Event
from app.models.gate import Gate
from app.models.gate_assignment import GateAssignment
from app.models.ticket import Ticket
from app.models.venue import Venue


now = datetime.datetime.now(datetime.timezone.utc)


def seed():
    db = SessionLocal()

    try:
        # ------------------------------------------------------------------ #
        # Venue                                                              #
        # ------------------------------------------------------------------ #

        venue = Venue(name="Mall of Asia Arena")
        db.add(venue)
        db.flush()

        # ------------------------------------------------------------------ #
        # Events                                                             #
        # ------------------------------------------------------------------ #

        event_scheduled = Event(
            venue_id=venue.venue_id,
            name="Taylor Swift:Eras Tour Manila",
            status=EventStatusEnum.SCHEDULED,
            start_time=now + datetime.timedelta(days=10),
            end_time=now + datetime.timedelta(days=10, hours=3),
            capacity=500,
        )

        event_active = Event(
            venue_id=venue.venue_id,
            name="Tinashe: 2 On World Tour",
            status=EventStatusEnum.ACTIVE,
            start_time=now + datetime.timedelta(hours=14),
            end_time=now + datetime.timedelta(hours=17),
            capacity=300,
        )

        event_concluded = Event(
            venue_id=venue.venue_id,
            name="Ravyn Lenae: Hypnos Tour",
            status=EventStatusEnum.CONCLUDED,
            start_time=now - datetime.timedelta(days=7, hours=3),
            end_time=now - datetime.timedelta(days=7),
            capacity=200,
        )

        event_cancelled = Event(
            venue_id=venue.venue_id,
            name="SZA: SOS Tour Manila",
            status=EventStatusEnum.CANCELLED,
            start_time=now + datetime.timedelta(days=5),
            end_time=now + datetime.timedelta(days=5, hours=3),
            capacity=400,
        )

        db.add_all([event_scheduled, event_active, event_concluded, event_cancelled])
        db.flush()

        # ------------------------------------------------------------------ #
        # Gates                                                              #
        # ------------------------------------------------------------------ #

        # gate_a: ONLINE, assigned to event_active -> happy path gate
        gate_a = Gate(
            venue_id=venue.venue_id,
            location="Hall A - Main Entrance",
            status=GateStatusEnum.ONLINE,
            gate_id=uuid.UUID("04adee71-453f-4fff-b5ba-e2b7c4046ced")
        )

        # gate_b: ONLINE, assigned to event_active -> second happy path gate
        gate_b = Gate(
            venue_id=venue.venue_id,
            location="Hall B - Side Entrance",
            status=GateStatusEnum.ONLINE,
        )

        # gate_offline: OFFLINE but has an ACTIVE assignment
        # Phase 2 G3
        # Demonstrates that gate status is checked independently of assignment
        gate_offline = Gate(
            venue_id=venue.venue_id,
            location="VIP Entrance",
            status=GateStatusEnum.OFFLINE,
        )

        # gate_unassigned: ONLINE but has no active assignment
        # Phase 2 G4
        # Simulates a case where the gate is up but operator forgot to assign it to the event on the platform
        gate_unassigned = Gate(
            venue_id=venue.venue_id,
            location="Emergency Exit - East Wing",
            status=GateStatusEnum.ONLINE,
        )

        # gate_bad_event: ONLINE, ACTIVE assignment, but assigned to event_concluded
        # Phase 2 G5
        # Simulates a gate left assigned after an event concluded
        gate_bad_event = Gate(
            venue_id=venue.venue_id,
            location="Backstage Gate",
            status=GateStatusEnum.ONLINE,
        )

        db.add_all([gate_a, gate_b, gate_offline, gate_unassigned, gate_bad_event])
        db.flush()

        # ------------------------------------------------------------------ #
        # Gate Assignments                                                   #
        # ------------------------------------------------------------------ #

        assignment_a = GateAssignment(
            gate_id=gate_a.gate_id,
            event_id=event_active.event_id,
            status=AssignmentStatusEnum.ACTIVE,
            assigned_at=now - datetime.timedelta(hours=2),
        )

        assignment_b = GateAssignment(
            gate_id=gate_b.gate_id,
            event_id=event_active.event_id,
            status=AssignmentStatusEnum.ACTIVE,
            assigned_at=now - datetime.timedelta(hours=2),
        )

        assignment_offline = GateAssignment(
            gate_id=gate_offline.gate_id,
            event_id=event_active.event_id,
            status=AssignmentStatusEnum.ACTIVE,
            assigned_at=now - datetime.timedelta(hours=2),
        )
        assignment_bad_event = GateAssignment(
            gate_id=gate_bad_event.gate_id,
            event_id=event_concluded.event_id,
            status=AssignmentStatusEnum.ACTIVE,
            assigned_at=now - datetime.timedelta(days=7, hours=4),
            # unassigned_at intentionally omitted: status is still ACTIVE
        )

        assignment_a_old = GateAssignment(
            gate_id=gate_a.gate_id,
            event_id=event_concluded.event_id,
            status=AssignmentStatusEnum.INACTIVE,
            assigned_at=now - datetime.timedelta(days=7, hours=4),
            unassigned_at=now - datetime.timedelta(days=7),
        )

        assignment_b_old = GateAssignment(
            gate_id=gate_b.gate_id,
            event_id=event_concluded.event_id,
            status=AssignmentStatusEnum.INACTIVE,
            assigned_at=now - datetime.timedelta(days=7, hours=4),
            unassigned_at=now - datetime.timedelta(days=7),
        )

        db.add_all([
            assignment_a,
            assignment_b,
            assignment_offline,
            assignment_bad_event,
            assignment_a_old,
            assignment_b_old,
        ])
        db.flush()

        # ------------------------------------------------------------------ #
        # Tickets: Concluded Event (audit trail, link_id already nulled)     #
        # ------------------------------------------------------------------ #

        ticket_concluded_1 = Ticket(
            link_id=None,  # Phase 5 cleanup already ran
            event_id=event_concluded.event_id,
            status=TicketStatusEnum.USED,
            created_at=now - datetime.timedelta(days=10),
            used_at=now - datetime.timedelta(days=7, hours=2),
        )

        ticket_concluded_2 = Ticket(
            link_id=None,
            event_id=event_concluded.event_id,
            status=TicketStatusEnum.USED,
            created_at=now - datetime.timedelta(days=9),
            used_at=now - datetime.timedelta(days=7, hours=2, minutes=15),
        )

        # Ticket was issued but never scanned
        ticket_concluded_3 = Ticket(
            link_id=None,
            event_id=event_concluded.event_id,
            status=TicketStatusEnum.UNUSED,
            created_at=now - datetime.timedelta(days=8),
        )

        db.add_all([ticket_concluded_1, ticket_concluded_2, ticket_concluded_3])
        db.flush()

        db.commit()
        print("Seed completed successfully.")
        print()
        print("Active event ID :", event_active.event_id)
        print("Concluded event ID:", event_concluded.event_id)
        print("Cancelled event ID:", event_cancelled.event_id)
        print()
        print("Gates:")
        print("  gate_a (ONLINE, assigned to active event) :", gate_a.gate_id)
        print("  gate_b (ONLINE, assigned to active event) :", gate_b.gate_id)
        print("  gate_offline    (OFFLINE, has active assignment) :", gate_offline.gate_id)
        print("  gate_unassigned (ONLINE,  no assignment)         :", gate_unassigned.gate_id)
        print("  gate_bad_event  (ONLINE,  assigned to concluded) :", gate_bad_event.gate_id)

    except Exception as e:
        db.rollback()
        print(f"Seed failed, rolled back: {e}")
        raise

    finally:
        db.close()


if __name__ == "__main__":
    seed()
