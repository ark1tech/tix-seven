from datetime import datetime
from typing import Literal, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.models.enums import DenialReasonEnum, EventStatusEnum, GateStatusEnum, ResultEnum, TicketStatusEnum


class VerifyRequest(BaseModel):
    """
    Incoming payload from the ESP8266 after a QR scan.
    """

    qr_payload: str
    gate_id: str


class VerifyResponse(BaseModel):
    """
    Response sent back to the ESP8266.
    """

    result: Literal["grant", "deny"]
    ticket_id: Optional[uuid.UUID] = None      # Populated only on "grant"
    reason: Optional[DenialReasonEnum] = None  # Populated only on "deny"


class VerifyContext(BaseModel):
    """
    Mutable pipeline state threaded through each verification phase.

    Fields are set only as far as resolution proceeds; a failure at any given step leaves all downstream fields as None.
    """

    model_config = ConfigDict(extra="forbid", validate_assignment=True)

    qr_payload: str
    gate_id: str

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


class EventStatusUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: EventStatusEnum


class EventResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event_id: uuid.UUID
    venue_id: uuid.UUID
    venue_name: str
    name: str
    status: EventStatusEnum
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


class GateResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    gate_id: uuid.UUID
    venue_id: uuid.UUID
    location: str
    status: GateStatusEnum
    event_id: Optional[uuid.UUID] = None  # None if no active assignment
