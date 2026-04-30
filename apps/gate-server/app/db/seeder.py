# seeder.py

import datetime

from app.db.session import SessionLocal
from app.models.enums import (
    AssignmentStatusEnum,
    DenialReasonEnum,
    EventStatusEnum,
    GateStatusEnum,
    ResultEnum,
    TicketStatusEnum,
)
from app.models.event import Event
from app.models.event_ticket_link import EventTicketLink
from app.models.gate import Gate
from app.models.gate_assignment import GateAssignment
from app.models.log import Log
from app.models.ticket import Ticket
from app.models.venue import Venue


now = datetime.datetime.now(datetime.timezone.utc)


def seed():
    db = SessionLocal()

    try:
        venue = Venue(name="Mall of Asia Arena")
        db.add(venue)
        db.flush()

        event_scheduled = Event(
            venue_id=venue.venue_id,
            name="Eras Tour Manila",
            status=EventStatusEnum.SCHEDULED,
            start_time=now + datetime.timedelta(days=10),
            end_time=now + datetime.timedelta(days=10, hours=3),
            capacity=500,
        )

        event_active = Event(
            venue_id=venue.venue_id,
            name="Tinashe: 2 On World Tour",
            status=EventStatusEnum.ACTIVE,
            start_time=now - datetime.timedelta(hours=1),
            end_time=now + datetime.timedelta(hours=2),
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

        db.add_all([event_scheduled, event_active, event_concluded])
        db.flush()

        gate_a = Gate(
            venue_id=venue.venue_id,
            location="Hall A - Main Entrance",
            status=GateStatusEnum.ONLINE,
        )

        gate_b = Gate(
            venue_id=venue.venue_id,
            location="Hall B - Side Entrance",
            status=GateStatusEnum.ONLINE,
        )

        gate_c = Gate(
            venue_id=venue.venue_id,
            location="VIP Entrance",
            status=GateStatusEnum.OFFLINE,
        )

        db.add_all([gate_a, gate_b, gate_c])
        db.flush()

        # gate_a and gate_b are assigned to the active event
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

        assignment_c_old = GateAssignment(
            gate_id=gate_a.gate_id,
            event_id=event_concluded.event_id,
            status=AssignmentStatusEnum.INACTIVE,
            assigned_at=now - datetime.timedelta(days=7, hours=4),
            unassigned_at=now - datetime.timedelta(days=7),
        )

        assignment_d_old = GateAssignment(
            gate_id=gate_b.gate_id,
            event_id=event_concluded.event_id,
            status=AssignmentStatusEnum.INACTIVE,
            assigned_at=now - datetime.timedelta(days=7, hours=4),
            unassigned_at=now - datetime.timedelta(days=7),
        )

        db.add_all([assignment_a, assignment_b, assignment_c_old, assignment_d_old])
        db.flush()

        link_paul = EventTicketLink(
            event_id=event_active.event_id,
            link_hash="hash_psut_paul_" + str(event_active.event_id),
        )
        link_arki = EventTicketLink(
            event_id=event_active.event_id,
            link_hash="hash_psut_arki_" + str(event_active.event_id),
        )
        link_kurt = EventTicketLink(
            event_id=event_active.event_id,
            link_hash="hash_psut_kurt_" + str(event_active.event_id),
        )

        db.add_all([link_paul, link_arki, link_kurt])
        db.flush()

        # Paul already scanned in
        ticket_paul = Ticket(
            link_id=link_paul.link_id,
            event_id=event_active.event_id,
            status=TicketStatusEnum.USED,
            created_at=now - datetime.timedelta(days=3),
            used_at=now - datetime.timedelta(minutes=30),
        )

        # Arki and Kurt are still outside
        ticket_arki = Ticket(
            link_id=link_arki.link_id,
            event_id=event_active.event_id,
            status=TicketStatusEnum.UNUSED,
            created_at=now - datetime.timedelta(days=2),
        )

        ticket_kurt = Ticket(
            link_id=link_kurt.link_id,
            event_id=event_active.event_id,
            status=TicketStatusEnum.UNUSED,
            created_at=now - datetime.timedelta(days=1),
        )

        db.add_all([ticket_paul, ticket_arki, ticket_kurt])
        db.flush()

        ticket_concluded_1 = Ticket(
            link_id=None,
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

        ticket_concluded_3 = Ticket(
            link_id=None,
            event_id=event_concluded.event_id,
            status=TicketStatusEnum.UNUSED,
            created_at=now - datetime.timedelta(days=8),
        )

        db.add_all([ticket_concluded_1, ticket_concluded_2, ticket_concluded_3])
        db.flush()

        log_granted = Log(
            raw_gate_id_snapshot=str(gate_a.gate_id),
            gate_id=gate_a.gate_id,
            gate_location_snapshot=gate_a.location,
            event_id=event_active.event_id,
            event_name_snapshot=event_active.name,
            assignment_id=assignment_a.assignment_id,
            ticket_id=ticket_paul.ticket_id,
            ticket_status_snapshot=TicketStatusEnum.UNUSED.value,  # status at scan time
            result=ResultEnum.GRANTED,
            denial_reason=None,
            timestamp=now - datetime.timedelta(minutes=30),
        )

        log_denied_identity = Log(
            raw_gate_id_snapshot=str(gate_a.gate_id),
            gate_id=gate_a.gate_id,
            gate_location_snapshot=gate_a.location,
            event_id=event_active.event_id,
            event_name_snapshot=event_active.name,
            assignment_id=assignment_a.assignment_id,
            ticket_id=None,
            ticket_status_snapshot=None,
            result=ResultEnum.DENIED,
            denial_reason=DenialReasonEnum.IDENTITY_NOT_VERIFIED,
            timestamp=now - datetime.timedelta(minutes=20),
        )

        log_denied_used = Log(
            raw_gate_id_snapshot=str(gate_b.gate_id),
            gate_id=gate_b.gate_id,
            gate_location_snapshot=gate_b.location,
            event_id=event_active.event_id,
            event_name_snapshot=event_active.name,
            assignment_id=assignment_b.assignment_id,
            ticket_id=ticket_paul.ticket_id,
            ticket_status_snapshot=TicketStatusEnum.USED.value,  # already redeemed
            result=ResultEnum.DENIED,
            denial_reason=DenialReasonEnum.TICKET_ALREADY_USED,
            timestamp=now - datetime.timedelta(minutes=15),
        )

        log_timeout = Log(
            raw_gate_id_snapshot=str(gate_b.gate_id),
            gate_id=gate_b.gate_id,
            gate_location_snapshot=gate_b.location,
            event_id=event_active.event_id,
            event_name_snapshot=event_active.name,
            assignment_id=assignment_b.assignment_id,
            ticket_id=None,
            ticket_status_snapshot=None,
            result=ResultEnum.DENIED,
            denial_reason=DenialReasonEnum.SERVER_TIMEOUT,
            timestamp=now - datetime.timedelta(minutes=10),
        )

        log_invalid_gate = Log(
            raw_gate_id_snapshot="not-a-valid-uuid",
            gate_id=None,
            gate_location_snapshot=None,
            event_id=None,
            event_name_snapshot=None,
            assignment_id=None,
            ticket_id=None,
            ticket_status_snapshot=None,
            result=ResultEnum.DENIED,
            denial_reason=DenialReasonEnum.INVALID_GATE_ID,
            timestamp=now - datetime.timedelta(minutes=5),
        )

        db.add_all([
            log_granted,
            log_denied_identity,
            log_denied_used,
            log_timeout,
            log_invalid_gate,
        ])
        db.flush()

        log_concluded_1 = Log(
            raw_gate_id_snapshot=str(gate_a.gate_id),
            gate_id=gate_a.gate_id,
            gate_location_snapshot=gate_a.location,
            event_id=event_concluded.event_id,
            event_name_snapshot=event_concluded.name,
            assignment_id=assignment_c_old.assignment_id,
            ticket_id=ticket_concluded_1.ticket_id,
            ticket_status_snapshot=TicketStatusEnum.UNUSED.value,
            result=ResultEnum.GRANTED,
            denial_reason=None,
            timestamp=now - datetime.timedelta(days=7, hours=2),
        )
        log_concluded_2 = Log(
            raw_gate_id_snapshot=str(gate_b.gate_id),
            gate_id=gate_b.gate_id,
            gate_location_snapshot=gate_b.location,
            event_id=event_concluded.event_id,
            event_name_snapshot=event_concluded.name,
            assignment_id=assignment_d_old.assignment_id,
            ticket_id=ticket_concluded_2.ticket_id,
            ticket_status_snapshot=TicketStatusEnum.UNUSED.value,
            result=ResultEnum.GRANTED,
            denial_reason=None,
            timestamp=now - datetime.timedelta(days=7, hours=2, minutes=15),
        )

        db.add_all([log_concluded_1, log_concluded_2])
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