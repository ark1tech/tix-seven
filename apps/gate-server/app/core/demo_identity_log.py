import logging
import uuid
from typing import Callable

from app.core.config import settings
from app.core.trace import get_trace_id
from app.models.enums import DenialReasonEnum
from app.models.schemas import VerifyContext

"""
Pure helpers for presentation-safe identity strings in server logs.

Callers pass ``log_full_identity`` from ``settings.demo_log_identity_values``.
"""


def format_uin_for_demo(uin: str | None, log_full_identity: bool) -> str:
    if uin is None or uin == "":
        return "UIN=<none>"
    if log_full_identity:
        return f"UIN={uin}"
    if len(uin) <= 4:
        return "UIN=****"
    return f"UIN=****{uin[-4:]}"


def format_psut_for_demo(psut: str | None, log_full_identity: bool) -> str:
    if psut is None or psut == "":
        return "PSUT=<none>"
    if log_full_identity:
        return f"PSUT={psut}"
    if len(psut) <= 4:
        return "PSUT=****"
    return f"PSUT=****{psut[-4:]}"


_DenyHandler = Callable[["DemoLogger", VerifyContext], None]

_log = logging.getLogger(__name__)


class DemoLogger:
    """
    Centralises all [DEMO] log lines.

    gate_id / event_id are optional because issuance only knows event_id, while verification knows both.
    """

    def __init__(
        self, *, gate_id: str | None = None, event_id: uuid.UUID | None = None
    ) -> None:
        self._gate_id = gate_id
        self._event_id = event_id
        self._full = settings.demo_log_identity_values

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _uin(self, uin: str | None) -> str:
        return format_uin_for_demo(uin, self._full)

    def _psut(self, psut: str | None) -> str:
        return format_psut_for_demo(psut, self._full)

    # ------------------------------------------------------------------
    # Issuance events
    # ------------------------------------------------------------------

    def sig_failed(self, uin: str | None) -> None:
        _log.info(
            "[DEMO] SIGNATURE VERIFICATION FAILED | TICKET NOT ISSUED | trace_id=%s event_id=%s %s",
            get_trace_id(),
            self._event_id,
            self._uin(uin),
        )

    def uin_verified_psut_issued(self, uin: str | None, psut: str | None) -> None:
        _log.info(
            "[DEMO] UIN VERIFIED | PSUT ISSUED | trace_id=%s event_id=%s %s %s",
            get_trace_id(),
            self._event_id,
            self._uin(uin),
            self._psut(psut),
        )

    def ticket_issued(self, uin: str | None, psut: str | None, ticket_id: uuid.UUID) -> None:
        _log.info(
            "[DEMO] TICKET ISSUED | %s | %s | TICKET STATUS: UNUSED | TICKET_ID=%s trace_id=%s event_id=%s",
            self._uin(uin),
            self._psut(psut),
            ticket_id,
            get_trace_id(),
            self._event_id,
        )

    # ------------------------------------------------------------------
    # Verification events
    # ------------------------------------------------------------------

    def auth_failed(self) -> None:
        _log.info(
            "[DEMO] CRYPTOGRAPHIC AUTHENTICATION FAILED | ACCESS DENIED trace_id=%s gate_id=%s event_id=%s",
            get_trace_id(),
            self._gate_id,
            self._event_id,
        )

    def ticket_not_found(self, uin: str | None, psut: str | None) -> None:
        _log.info(
            "[DEMO] TICKET NOT FOUND FOR UIN | ACCESS DENIED trace_id=%s gate_id=%s event_id=%s %s %s",
            get_trace_id(),
            self._gate_id,
            self._event_id,
            self._uin(uin),
            self._psut(psut),
        )

    def ticket_already_used(self, uin: str | None, psut: str | None) -> None:
        _log.info(
            "[DEMO] UIN VERIFIED | TICKET STATUS: USED | ACCESS DENIED trace_id=%s gate_id=%s event_id=%s %s %s",
            get_trace_id(),
            self._gate_id,
            self._event_id,
            self._uin(uin),
            self._psut(psut),
        )

    def access_granted(self, uin: str | None, psut: str | None, ticket_id: uuid.UUID) -> None:
        _log.info(
            "[DEMO] UIN VERIFIED | TICKET STATUS: UNUSED | ACCESS GRANTED | TICKET_ID=%s trace_id=%s gate_id=%s event_id=%s %s %s",
            ticket_id,
            get_trace_id(),
            self._gate_id,
            self._event_id,
            self._uin(uin),
            self._psut(psut),
        )

    # ------------------------------------------------------------------
    # Verification denial dispatch
    # ------------------------------------------------------------------

    _DENY_HANDLERS: dict[DenialReasonEnum, _DenyHandler] = {
        DenialReasonEnum.IDENTITY_NOT_VERIFIED: lambda d, _: d.auth_failed(
        ),
        DenialReasonEnum.LINK_NOT_FOUND: lambda d, ctx: d.ticket_not_found(
            ctx.uin, ctx.psut
        ),
        DenialReasonEnum.TICKET_ALREADY_USED: lambda d, ctx: d.ticket_already_used(
            ctx.uin, ctx.psut
        ),
    }

    def on_deny(self, reason: DenialReasonEnum, ctx: VerifyContext) -> None:
        handler = self._DENY_HANDLERS.get(reason)

        if handler:
            handler(self, ctx)
