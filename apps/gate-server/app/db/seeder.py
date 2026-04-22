# seed.py

import uuid
import datetime
from app.db.session import SessionLocal
from app.models.venue import Venue
from app.models.event import Event
from app.models.gate import Gate
from app.models.gate_assignment import GateAssignment
from app.models.event_ticket_link import EventTicketLink
from app.models.ticket import Ticket
from app.models.log import Log
from app.models.enums import (
    GateStatusEnum,
    TicketStatusEnum,
    ResultEnum,
    EventStatusEnum,
    AssignmentStatusEnum,
    DenialReasonEnum,
)

now = datetime.datetime.now()


def seed():
    db = SessionLocal()

    try:
        # Venues

        venue = Venue(
            venue_id=uuid.uuid4(),
            name="Mall of Asia Arena",
        )

        db.add(venue)
        db.flush()


        # Events

        event_upcoming = Event(
            event_id=uuid.uuid4(),
            venue_id=venue.venue_id,
            name="Eras Tour Manila",
            status=EventStatusEnum.SCHEDULED,
            start_time=now + datetime.timedelta(days=10),
            end_time=now + datetime.timedelta(days=10, hours=3),
            capacity=500,
        )

        event_active = Event(
            event_id=uuid.uuid4(),
            venue_id=venue.venue_id,
            name="Tinashe Is So 2 On World Tour",
            status=EventStatusEnum.ACTIVE,
            start_time=now - datetime.timedelta(hours=1),
            end_time=now + datetime.timedelta(hours=2),
            capacity=300,
        )

        db.add_all([event_upcoming, event_active])
        db.flush()

        # Gates

        gate_a = Gate(
            gate_id=uuid.uuid4(),
            venue_id=venue.venue_id,
            location="Hall A Primary",
            status=GateStatusEnum.ONLINE,
        )

        gate_b = Gate(
            gate_id=uuid.uuid4(),
            venue_id=venue.venue_id,
            location="Hall B Secondary",
            status=GateStatusEnum.ONLINE,
        )

        gate_c = Gate(
            gate_id=uuid.uuid4(),
            venue_id=venue.venue_id,
            location="VIP Entrance",
            status=GateStatusEnum.OFFLINE,
        )

        db.add_all([gate_a, gate_b, gate_c])
        db.flush()

        # Gate Assignments

        # gate_a and gate_b are assigned to the active event
        # gate_c is offline and unassigned

        assignment_a = GateAssignment(
            assignment_id=uuid.uuid4(),
            gate_id=gate_a.gate_id,
            event_id=event_active.event_id,
            status=AssignmentStatusEnum.ACTIVE,
            assigned_at=now - datetime.timedelta(hours=2),
            unassigned_at=None,
        )

        assignment_b = GateAssignment(
            assignment_id=uuid.uuid4(),
            gate_id=gate_b.gate_id,
            event_id=event_active.event_id,
            status=AssignmentStatusEnum.ACTIVE,
            assigned_at=now - datetime.timedelta(hours=2),
            unassigned_at=None,
        )

        db.add_all([assignment_a, assignment_b])
        db.flush()

        # EventTicketLinks
        # Three attendees for the active event

        link_1 = EventTicketLink(
            link_id=uuid.uuid4(),
            event_id=event_active.event_id,
            link_hash="hash_psut_paul_" + str(event_active.event_id),
        )
        link_2 = EventTicketLink(
            link_id=uuid.uuid4(),
            event_id=event_active.event_id,
            link_hash="hash_psut_arki_" + str(event_active.event_id),
        )
        link_3 = EventTicketLink(
            link_id=uuid.uuid4(),
            event_id=event_active.event_id,
            link_hash="hash_psut_kurt_" + str(event_active.event_id),
        )

        db.add_all([link_1, link_2, link_3])
        db.flush()

        # Tickets

        ticket_1 = Ticket(
            ticket_id=uuid.uuid4(),
            link_id=link_1.link_id,
            event_id=event_active.event_id,
            status=TicketStatusEnum.USED,
            created_at=now - datetime.timedelta(days=3),
            used_at=now - datetime.timedelta(minutes=30),
        )
        ticket_2 = Ticket(
            ticket_id=uuid.uuid4(),
            link_id=link_2.link_id,
            event_id=event_active.event_id,
            status=TicketStatusEnum.UNUSED,
            created_at=now - datetime.timedelta(days=2),
            used_at=None,
        )
        ticket_3 = Ticket(
            ticket_id=uuid.uuid4(),
            link_id=link_3.link_id,
            event_id=event_active.event_id,
            status=TicketStatusEnum.UNUSED,
            created_at=now - datetime.timedelta(days=1),
            used_at=None,
        )

        db.add_all([ticket_1, ticket_2, ticket_3])
        db.flush()

        # Logs

        log_granted = Log(
            log_id=uuid.uuid4(),
            event_id=event_active.event_id,
            gate_id=gate_a.gate_id,
            assignment_id=assignment_a.assignment_id,
            ticket_id=ticket_1.ticket_id,
            result=ResultEnum.GRANTED,
            denial_reason=None,
            timestamp=now - datetime.timedelta(minutes=30),
        )

        log_denied = Log(
            log_id=uuid.uuid4(),
            event_id=event_active.event_id,
            gate_id=gate_a.gate_id,
            assignment_id=assignment_a.assignment_id,
            ticket_id=None,  # identity verification failed as no ticket resolved
            result=ResultEnum.DENIED,
            denial_reason=DenialReasonEnum.IDENTITY_NOT_VERIFIED,
            timestamp=now - datetime.timedelta(minutes=20),
        )

        log_timeout = Log(
            log_id=uuid.uuid4(),
            event_id=event_active.event_id,
            gate_id=gate_b.gate_id,
            assignment_id=assignment_b.assignment_id,
            ticket_id=None,
            result=ResultEnum.TIMEOUT,
            denial_reason=None,
            timestamp=now - datetime.timedelta(minutes=10),
        )

        db.add_all([log_granted, log_denied, log_timeout])
        db.flush()

        db.commit()
        print("Seed completed successfully.")

    except Exception as e:
        db.rollback()
        print(f"Seed failed, rolled back: {e}")
        raise

    finally:
        db.close()


if __name__ == "__main__":
    seed()
