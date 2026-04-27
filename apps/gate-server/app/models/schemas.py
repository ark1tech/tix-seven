from datetime import datetime
from typing import Literal, Optional
import uuid
from pydantic import BaseModel, ConfigDict
from app.models.enums import DenialReasonEnum, ResultEnum


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
    ticket_id: Optional[str] = None            # Populated only on "grant"
    reason: Optional[DenialReasonEnum] = None  # Populated only on "deny"


class VerifyContext(BaseModel):
    """
    Mutable pipeline state threaded through each verification phase.

    All Optional fields start as None and are set only if the corresponding phase completes successfully.
    """

    model_config = ConfigDict(
        extra="forbid",
        validate_assignment=True,
        arbitrary_types_allowed=False,
    )

    qr_payload: str
    gate_id: str

    event_id: Optional[uuid.UUID] = None
    assignment_id: Optional[uuid.UUID] = None
    uin: Optional[str] = None
    psut: Optional[str] = None
    link_hash: Optional[str] = None
    link_id: Optional[uuid.UUID] = None
    ticket_id: Optional[uuid.UUID] = None

    result: Optional[ResultEnum] = None
    denial_reason: Optional[DenialReasonEnum] = None
    response: Optional["VerifyResponse"] = None
    # Set on controlled denies (_deny) or on unhandled exception before result assignment.
    error_code: Optional[str] = None


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
    status: Literal["UNUSED"]
    created_at: datetime


class IssueContext(BaseModel):
    """
    Mutable pipeline state threaded through each issuance phase.

    All Optional fields start as None and are set only if the corresponding phase completes successfully.
    """

    model_config = ConfigDict(
        extra="forbid",
        validate_assignment=True,
        arbitrary_types_allowed=False,
    )

    qr_payload: str
    event_id: uuid.UUID

    uin: Optional[str] = None
    psut: Optional[str] = None
    link_hash: Optional[str] = None
    link_id: Optional[uuid.UUID] = None
    ticket_id: Optional[uuid.UUID] = None
    created_at: Optional[datetime] = None