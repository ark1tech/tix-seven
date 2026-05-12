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
