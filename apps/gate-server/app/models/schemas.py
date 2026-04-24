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


class IssueRequest(BaseModel):
    qr_payload: str
    event_id: uuid.UUID


class IssueResponse(BaseModel):
    ticket_id: uuid.UUID
    link_id: uuid.UUID
    status: Literal["UNUSED"]
    created_at: datetime