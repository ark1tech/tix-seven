import enum


class GateStatusEnum(str, enum.Enum):
    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"


class TicketStatusEnum(str, enum.Enum):
    UNUSED = "UNUSED"
    USED = "USED"


class ResultEnum(str, enum.Enum):
    GRANTED = "GRANTED"
    DENIED = "DENIED"
    TIMEOUT = "TIMEOUT"  # ESP8266 did not receive a response within the deadline
    ERROR = "ERROR"


class EventStatusEnum(str, enum.Enum):
    SCHEDULED = "SCHEDULED"  # Event created but not yet started
    ACTIVE = "ACTIVE"        # Event underway
    CONCLUDED = "CONCLUDED"  # Event finished
    CANCELLED = "CANCELLED"  # Event cancelled; no tickets should be valid


class AssignmentStatusEnum(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class DenialReasonEnum(str, enum.Enum):
    # Phase 2, Step 1: Gate validation

    # The gate_id is invalid, malformed, or doesn't exist in the system
    INVALID_GATE_ID = "INVALID_GATE_ID"

    # The gate exists but is marked OFFLINE and cannot accept any scans
    GATE_OFFLINE = "GATE_OFFLINE"

    # The gate has no ACTIVE assignment and event context cannot be resolved
    INVALID_GATE_ASSIGNMENT = "INVALID_GATE_ASSIGNMENT"

    # The gate's active assignment references a non-existent event
    EVENT_NOT_FOUND = "EVENT_NOT_FOUND"

    # The gate is assigned but the event is in CONCLUDED state
    EVENT_CONCLUDED = "EVENT_CONCLUDED"

    # The gate is assigned but the event is in CANCELLED state
    EVENT_CANCELLED = "EVENT_CANCELLED"

    # Phase 2, Step 3: MOSIP verification failed due to invalid, inactive, or mismatched identity
    IDENTITY_NOT_VERIFIED = "IDENTITY_NOT_VERIFIED"

    # Phase 2, Step 5: No EventTicketLink exists for the computed link_hash
    LINK_NOT_FOUND = "LINK_NOT_FOUND"

    # Phase 2, Step 6a: Ticket record is missing despite an existing valid link
    TICKET_NOT_FOUND = "TICKET_NOT_FOUND"

    # Phase 2, Step 6b: Ticket has already been redeemed and is no longer valid
    TICKET_ALREADY_USED = "TICKET_ALREADY_USED"

    # System or network failures
    SERVER_TIMEOUT = "SERVER_TIMEOUT"
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR"
