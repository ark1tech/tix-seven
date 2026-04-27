from __future__ import annotations

from contextvars import ContextVar, Token
import re
import uuid

_trace_id_ctx: ContextVar[str] = ContextVar("trace_id", default="-")
_TRACE_ID_RE = re.compile(r"^[a-zA-Z0-9._:-]{8,64}$")


def _normalize_trace_id(raw_trace_id: str | None) -> str:
    if raw_trace_id is None:
        return uuid.uuid4().hex

    candidate = raw_trace_id.strip()
    if _TRACE_ID_RE.match(candidate):
        return candidate
    return uuid.uuid4().hex


def start_trace_context(raw_trace_id: str | None) -> tuple[Token[str], str]:
    trace_id = _normalize_trace_id(raw_trace_id)
    token = _trace_id_ctx.set(trace_id)
    return token, trace_id


def end_trace_context(token: Token[str]) -> None:
    _trace_id_ctx.reset(token)


def get_trace_id() -> str:
    return _trace_id_ctx.get()
