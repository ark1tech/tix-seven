import enum


class GateStatusEnum(str, enum.Enum):
    ONLINE = "online"
    OFFLINE = "offline"


class TicketStatusEnum(str, enum.Enum):
    UNUSED = "unused"
    USED = "used"


class ResultEnum(str, enum.Enum):
    GRANTED = "granted"
    DENIED = "denied"
    TIMEOUT = "timeout"
    ERROR = "error"
