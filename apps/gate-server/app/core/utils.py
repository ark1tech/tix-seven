import re
import uuid
from sqlalchemy.exc import IntegrityError


_CONSTRAINT_NAME_RE = re.compile(r'constraint "([^"]+)"', re.IGNORECASE)


def parse_uuid(raw: str) -> uuid.UUID | None:
    """
    Parse a UUID string. Return None on failure rather than raising.

    Utilized to convert raw gate_id strings from the ESP8266 safely.
    """

    try:
        return uuid.UUID(raw)
    except (TypeError, ValueError):
        return None


def short_error_message(exc: BaseException, limit: int = 400) -> str:
    """
    Truncate an exception message to a safer length for logging.
    
    Collapses newlines so the message fits on a single log line.
    """

    text = str(exc).replace("\n", " ").strip()

    if len(text) > limit:
        return f"{text[: limit - 3]}..."

    return text


def integrity_constraint_label(exc: IntegrityError) -> str | None:
    """
    Extraction of the violated Postgres constraint name from an IntegrityError, without logging raw parameter values or hashes.
    """

    # Tries the psycopg2 diagnostics object first
    orig = getattr(exc, "orig", None)

    if orig is not None:
        diag = getattr(orig, "diag", None)
    
        if diag is not None:
            name = getattr(diag, "constraint_name", None)
        
            if name:
                return str(name)

    # Falls back to a regex on the stringified exception
    match = _CONSTRAINT_NAME_RE.search(str(exc))

    if match:
        return match.group(1)

    return None
