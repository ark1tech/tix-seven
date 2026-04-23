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
    TIMEOUT = "TIMEOUT"
    ERROR = "ERROR"


class EventStatusEnum(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    ACTIVE = "ACTIVE"
    CONCLUDED = "CONCLUDED"


class AssignmentStatusEnum(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class DenialReasonEnum(str, enum.Enum):
    # Phase 2, Step 1: Gate (assignment) not valid
    INVALID_GATE_ID = "INVALID_GATE_ID"
    INVALID_GATE_ASSIGNMENT = "INVALID_GATE_ASSIGNMENT"

    # Phase 2, Step 3: MOSIP verification failure
    IDENTITY_NOT_VERIFIED = "IDENTITY_NOT_VERIFIED"
    
    # Phase 2, Step 5: EventTicketLink query returns no record
    LINK_NOT_FOUND = "LINK_NOT_FOUND"
    
    WRONG_EVENT = "WRONG_EVENT"

    # Phase 2, Step 6a: Ticket query returns no record for the event
    TICKET_NOT_FOUND = "TICKET_NOT_FOUND"
    
    # Phase 2, Step 6b: Ticket exists but its status is not "unused"
    TICKET_ALREADY_USED = "TICKET_ALREADY_USED"
    
    # System or network failures
    SERVER_TIMEOUT = "SERVER_TIMEOUT"
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR"
