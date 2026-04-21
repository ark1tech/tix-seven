from enum import Enum
from typing import Literal, Optional
from pydantic import BaseModel


class DenialReason(str, Enum):
    invalid_id = "invalid_id"
    no_ticket = "no_ticket"
    already_used = "already_used"
    wrong_event = "wrong_event"


class VerifyRequest(BaseModel):
    qr_payload: str
    gate_id: str


class VerifyResponse(BaseModel):
    result: Literal["grant", "deny"]
    ticket_id: Optional[str] = None
    reason: Optional[DenialReason] = None
