from datetime import datetime
from typing import Literal, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.models.enums import (
    DenialReasonEnum,
    EventStatusEnum,
    GateStatusEnum,
    ResultEnum,
    TicketStatusEnum,
)


class VerifyRequest(BaseModel):
    """
    Incoming payload from the ESP8266 after a QR scan.
    """

    qr_payload: str
    gate_id: str
    stub_mosip: Optional[bool] = False


class VerifyResponse(BaseModel):
    """
    Response sent back to the ESP8266.
    """

    result: Literal["grant", "deny"]
    ticket_id: Optional[uuid.UUID] = None  # Populated only on "grant"
    reason: Optional[DenialReasonEnum] = None  # Populated only on "deny"


class VerifyContext(BaseModel):
    """
    Mutable pipeline state threaded through each verification phase.

    Fields are set only as far as resolution proceeds; a failure at any given step leaves all downstream fields as None.
    """

    model_config = ConfigDict(extra="forbid", validate_assignment=True)

    qr_payload: str
    gate_id: str
    stub_mosip: bool = False

    gate_uuid: Optional[uuid.UUID] = None
    event_id: Optional[uuid.UUID] = None
    event_name_snapshot: Optional[str] = None
    assignment_id: Optional[uuid.UUID] = None
    gate_location_snapshot: Optional[str] = None

    uin: Optional[str] = None
    psut: Optional[str] = None
    link_hash: Optional[str] = None

    link_id: Optional[uuid.UUID] = None
    ticket_id: Optional[uuid.UUID] = None
    ticket_status_snapshot: Optional[str] = None

    result: Optional[ResultEnum] = None
    denial_reason: Optional[DenialReasonEnum] = None
    response: Optional["VerifyResponse"] = None


class VerifiedIdentity(BaseModel):
    """
    The subset of a successful MOSIP response the rest of the system cares about.

    Returned by IdentityService.verify() and consumed by both IssuanceService and VerificationService so neither service talks to the MOSIP adapter directly.
    """

    uin: str
    psut: str


class IssueRequest(BaseModel):
    """
    Incoming payload for the ticket-issuance endpoint.
    """

    qr_payload: str
    event_id: uuid.UUID
    stub_mosip: Optional[bool] = False


class IssueResponse(BaseModel):
    """
    Confirmation returned to the caller after a ticket is successfully issued.
    """

    ticket_id: uuid.UUID
    link_id: uuid.UUID
    status: Literal[TicketStatusEnum.UNUSED]
    created_at: datetime


class IssueContext(BaseModel):
    """
    Mutable pipeline state threaded through each issuance phase.

    Fields are set only as far as resolution proceeds; a failure at any given step leaves all downstream fields as None.
    """

    model_config = ConfigDict(extra="forbid", validate_assignment=True)

    qr_payload: str
    event_id: uuid.UUID

    uin: Optional[str] = None
    psut: Optional[str] = None
    link_hash: Optional[str] = None

    link_id: Optional[uuid.UUID] = None
    ticket_id: Optional[uuid.UUID] = None
    created_at: Optional[datetime] = None

    stub_mosip: bool = False


# ---------------------------------------------------------------------------
# Venue Schemas
# ---------------------------------------------------------------------------


class VenueCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str


class VenueUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str


class VenueResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    venue_id: uuid.UUID
    name: str


# ---------------------------------------------------------------------------
# Ticket Schemas
# ---------------------------------------------------------------------------


class TicketEntry(BaseModel):
    """
    One row in the Issued Tickets Table.
    """

    model_config = ConfigDict(extra="forbid")

    ticket_id: uuid.UUID
    status: TicketStatusEnum
    created_at: datetime
    used_at: Optional[datetime] = None
    link_id: Optional[uuid.UUID] = None


class TicketSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total: int
    used: int
    unused: int


class TicketFilters(BaseModel):
    """
    Query parameters accepted by GET /events/{event_id}/tickets.
    """

    model_config = ConfigDict(extra="forbid")

    status: Optional[TicketStatusEnum] = None
    sort_by: Optional[str] = "created_at"
    sort_direction: Optional[str] = "desc"


class TicketListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: TicketSummary
    tickets: list[TicketEntry]


# ---------------------------------------------------------------------------
# Event Schemas
# ---------------------------------------------------------------------------


class EventCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    venue_id: uuid.UUID
    name: str
    start_time: datetime
    end_time: datetime
    capacity: int = Field(gt=0)

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")

        return self


class EventUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = None
    venue_id: Optional[uuid.UUID] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    capacity: Optional[int] = Field(default=None, gt=0)

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.end_time and self.start_time and self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")

        return self


class EventStatusUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: EventStatusEnum


class EventSummaryResponse(BaseModel):
    """
    One row in the Event List View.
    """

    model_config = ConfigDict(extra="forbid")

    event_id: uuid.UUID
    name: str
    status: EventStatusEnum
    venue_name: str
    start_time: datetime
    end_time: datetime
    capacity: int
    admitted_count: int  # tickets with status = USED for this event


class AssignedGate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    gate_id: uuid.UUID
    location: str
    status: GateStatusEnum
    assignment_id: uuid.UUID  # surfaced for debug


class EventDetailResponse(BaseModel):
    """
    Full payload for the Event Detail View.

    Combines identity and schedule fields with the aggregated gate list and ticket summary so the detail page needs only one round-trip.
    """

    model_config = ConfigDict(extra="forbid")

    event_id: uuid.UUID
    name: str
    status: EventStatusEnum
    venue_id: uuid.UUID
    venue_name: str
    start_time: datetime
    end_time: datetime
    capacity: int
    admitted_count: int

    assigned_gates: list[AssignedGate]
    ticket_summary: TicketSummary


class EventResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event_id: uuid.UUID
    name: str
    status: EventStatusEnum
    venue_id: uuid.UUID
    venue_name: str
    start_time: datetime
    end_time: datetime
    capacity: int


# ---------------------------------------------------------------------------
# Gate Schemas
# ---------------------------------------------------------------------------


class GateCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    venue_id: uuid.UUID
    location: str
    event_id: Optional[uuid.UUID] = None


class GateUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    location: Optional[str] = None
    event_id: Optional[uuid.UUID] = None
    status: Optional[GateStatusEnum] = None


class GateResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    gate_id: uuid.UUID
    venue_id: uuid.UUID
    location: str
    status: GateStatusEnum
    event_id: Optional[uuid.UUID] = None  # None if no active assignment


class GateFilterOption(BaseModel):
    model_config = ConfigDict(extra="forbid")

    gate_id: uuid.UUID
    location: str


# ---------------------------------------------------------------------------
# Log Schemas
# ---------------------------------------------------------------------------


class LogEntry(BaseModel):
    """
    One row in the Entry Log Table.
    """

    model_config = ConfigDict(extra="forbid")

    log_id: uuid.UUID
    timestamp: datetime
    raw_gate_id_snapshot: str
    gate_location_snapshot: Optional[str] = None
    result: ResultEnum
    denial_reason: Optional[DenialReasonEnum] = None
    ticket_id: Optional[uuid.UUID] = None
    ticket_status_snapshot: Optional[str] = None


class DenialReasonCount(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: DenialReasonEnum
    count: int


class LogSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total: int
    granted: int
    denied: int
    timeout_or_error: int
    denial_breakdown: list[DenialReasonCount]


class LogFilters(BaseModel):
    """
    Query parameters accepted by GET /events/{event_id}/logs.
    """

    model_config = ConfigDict(extra="forbid")

    result: Optional[ResultEnum] = None
    gate_id: Optional[uuid.UUID] = None
    from_time: Optional[datetime] = None
    to_time: Optional[datetime] = None


class LogListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: LogSummary
    logs: list[LogEntry]
