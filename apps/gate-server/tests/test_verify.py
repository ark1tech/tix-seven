import uuid
from types import SimpleNamespace
from unittest import mock
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from app.adapters.mosip import MOSIPUnavailableError, StubMOSIPAdapter
from app.models.enums import DenialReasonEnum, ResultEnum, TicketStatusEnum
from app.models.log import Log
from app.models.scan_attempt_log import ScanAttemptLog
from app.services.identity import IdentityService
from app.services.verification import VerificationService


def test_health(client: TestClient):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "db": "ok"}


def test_verify_requires_api_key(client: TestClient):
    res = client.post("/verify", json={"qr_payload": "test", "gate_id": "gate-1"})
    assert res.status_code == 403


def test_verify_invalid_qr_returns_deny(client: TestClient, auth_headers: dict):
    res = client.post(
        "/verify",
        json={"qr_payload": "", "gate_id": "gate-1"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["result"] == "deny"
    # "gate-1" is not a UUID -> invalid gate id
    assert body["reason"] == DenialReasonEnum.INVALID_GATE_ID.value


def test_verify_no_ticket_returns_deny(
    client: TestClient, auth_headers: dict, monkeypatch
):
    assignment_id = uuid.uuid4()
    event_id = uuid.uuid4()
    link_id = uuid.uuid4()

    def fake_get_active_assignment(self, _gate_id):
        return (assignment_id, event_id)

    def fake_verify_identity(self, ctx):
        ctx.uin = "1234567890123456"
        ctx.psut = "PSUT"
        ctx.link_hash = "linkhash"
        return ctx

    def fake_find_link(self, _event_id, _link_hash):
        return SimpleNamespace(link_id=link_id)

    def fake_find_ticket(self, _link_id):
        return None

    monkeypatch.setattr(VerificationService, "_get_active_assignment", fake_get_active_assignment)
    monkeypatch.setattr(VerificationService, "_verify_identity", fake_verify_identity)
    monkeypatch.setattr(VerificationService, "_find_link", fake_find_link)
    monkeypatch.setattr(VerificationService, "_find_ticket", fake_find_ticket)

    res = client.post(
        "/verify",
        json={"qr_payload": '{"uin":"1234567890123456"}', "gate_id": str(uuid.uuid4())},
        headers=auth_headers,
    )
    body = res.json()
    assert body["result"] == "deny"
    assert body["reason"] == DenialReasonEnum.TICKET_NOT_FOUND.value


def test_verify_already_used_returns_deny(
    client: TestClient, auth_headers: dict, monkeypatch
):
    assignment_id = uuid.uuid4()
    event_id = uuid.uuid4()
    link_id = uuid.uuid4()
    used_ticket = SimpleNamespace(ticket_id=uuid.uuid4(), status=TicketStatusEnum.USED)

    def fake_get_active_assignment(self, _gate_id):
        return (assignment_id, event_id)

    def fake_verify_identity(self, ctx):
        ctx.uin = "1234567890123456"
        ctx.psut = "PSUT"
        ctx.link_hash = "linkhash"
        return ctx

    def fake_find_link(self, _event_id, _link_hash):
        return SimpleNamespace(link_id=link_id)

    def fake_find_ticket(self, _link_id):
        return used_ticket

    monkeypatch.setattr(VerificationService, "_get_active_assignment", fake_get_active_assignment)
    monkeypatch.setattr(VerificationService, "_verify_identity", fake_verify_identity)
    monkeypatch.setattr(VerificationService, "_find_link", fake_find_link)
    monkeypatch.setattr(VerificationService, "_find_ticket", fake_find_ticket)

    res = client.post(
        "/verify",
        json={"qr_payload": '{"uin":"1234567890123456"}', "gate_id": str(uuid.uuid4())},
        headers=auth_headers,
    )
    body = res.json()
    assert body["result"] == "deny"
    assert body["reason"] == DenialReasonEnum.TICKET_ALREADY_USED.value


def test_verify_grant_marks_ticket_used(
    client: TestClient, auth_headers: dict, monkeypatch
):
    assignment_id = uuid.uuid4()
    event_id = uuid.uuid4()
    link_id = uuid.uuid4()
    unused_ticket = SimpleNamespace(ticket_id=uuid.uuid4(), status=TicketStatusEnum.UNUSED)

    def fake_get_active_assignment(self, _gate_id):
        return (assignment_id, event_id)

    def fake_verify_identity(self, ctx):
        ctx.uin = "1234567890123456"
        ctx.psut = "PSUT"
        ctx.link_hash = "linkhash"
        return ctx

    def fake_find_link(self, _event_id, _link_hash):
        return SimpleNamespace(link_id=link_id)

    def fake_find_ticket(self, _link_id):
        return unused_ticket

    monkeypatch.setattr(VerificationService, "_get_active_assignment", fake_get_active_assignment)
    monkeypatch.setattr(VerificationService, "_verify_identity", fake_verify_identity)
    monkeypatch.setattr(VerificationService, "_find_link", fake_find_link)
    monkeypatch.setattr(VerificationService, "_find_ticket", fake_find_ticket)
    monkeypatch.setattr(VerificationService, "_mark_used", lambda self, _tid: True)

    res = client.post(
        "/verify",
        json={"qr_payload": '{"uin":"1234567890123456"}', "gate_id": str(uuid.uuid4())},
        headers=auth_headers,
    )
    body = res.json()
    assert body["result"] == "grant"
    assert body["ticket_id"] == str(unused_ticket.ticket_id)
    assert body["reason"] is None


def test_verify_wrong_event_returns_deny(
    client: TestClient, auth_headers: dict, monkeypatch
):
    def fake_get_active_assignment(self, _gate_id):
        return None

    monkeypatch.setattr(VerificationService, "_get_active_assignment", fake_get_active_assignment)

    res = client.post(
        "/verify",
        json={"qr_payload": '{"uin":"1234567890123456"}', "gate_id": str(uuid.uuid4())},
        headers=auth_headers,
    )
    body = res.json()
    assert body["result"] == "deny"
    assert body["reason"] == DenialReasonEnum.INVALID_GATE_ASSIGNMENT.value


def test_mosip_timeout_logs_server_timeout_not_internal_error() -> None:
    """
    MOSIP transport failure should map to DENIED / SERVER_TIMEOUT (explicit denial),
    not an unhandled ERROR path. Log rows must satisfy check_denial_reason_consistency:
    (result = 'GRANTED') = (denial_reason IS NULL).
    """
    db = MagicMock()
    event_id = uuid.uuid4()
    assignment_id = uuid.uuid4()
    db.execute.return_value.first.return_value = (assignment_id, event_id)

    class TimingOutMOSIP:
        def verify(self, _qr_payload: str):
            raise MOSIPUnavailableError("Read timed out")

    service = VerificationService(
        db=db,
        identity=IdentityService(mosip=TimingOutMOSIP()),
    )
    response = service.verify('{"uin":"1234567890123456"}', str(uuid.uuid4()))

    assert response.result == "deny"
    assert response.reason == DenialReasonEnum.SERVER_TIMEOUT

    db.rollback.assert_called_once()
    db.commit.assert_called_once()

    assert db.add.call_count == 2
    scan_entry: ScanAttemptLog = db.add.call_args_list[0][0][0]
    log_entry: Log = db.add.call_args_list[1][0][0]
    assert isinstance(scan_entry, ScanAttemptLog)
    assert isinstance(log_entry, Log)
    assert scan_entry.result == ResultEnum.DENIED
    assert scan_entry.denial_reason == DenialReasonEnum.SERVER_TIMEOUT
    assert scan_entry.error_code == "DENY_MOSIP_UNAVAILABLE"
    assert log_entry.result == ResultEnum.DENIED
    assert log_entry.denial_reason == DenialReasonEnum.SERVER_TIMEOUT


def test_scan_attempt_invalid_gate_id_no_operational_log() -> None:
    """Malformed gate_id: scan_attempt_log is written; event-linked log is skipped."""
    db = MagicMock()
    service = VerificationService(
        db=db,
        identity=IdentityService(mosip=StubMOSIPAdapter()),
    )
    out = service.verify("{}", "not-a-uuid")
    assert out.result == "deny"
    assert out.reason == DenialReasonEnum.INVALID_GATE_ID
    db.rollback.assert_called_once()
    db.commit.assert_called_once()
    assert db.add.call_count == 1
    scan_entry: ScanAttemptLog = db.add.call_args[0][0]
    assert isinstance(scan_entry, ScanAttemptLog)
    assert scan_entry.gate_id_raw == "not-a-uuid"
    assert scan_entry.gate_id is None
    assert scan_entry.event_id is None
    assert scan_entry.result == ResultEnum.DENIED
    assert scan_entry.denial_reason == DenialReasonEnum.INVALID_GATE_ID
    assert scan_entry.error_code == "DENY_INVALID_GATE_ID"


def test_scan_attempt_invalid_gate_assignment() -> None:
    """No active assignment: only scan_attempt_log (no event_id for Log)."""
    db = MagicMock()
    db.execute.return_value.first.return_value = None
    gid = str(uuid.uuid4())
    service = VerificationService(
        db=db,
        identity=IdentityService(mosip=StubMOSIPAdapter()),
    )
    out = service.verify("{}", gid)
    assert out.result == "deny"
    assert out.reason == DenialReasonEnum.INVALID_GATE_ASSIGNMENT
    assert db.add.call_count == 1
    scan_entry: ScanAttemptLog = db.add.call_args[0][0]
    assert isinstance(scan_entry, ScanAttemptLog)
    assert scan_entry.gate_id == uuid.UUID(gid)
    assert scan_entry.event_id is None
    assert scan_entry.error_code == "DENY_INVALID_GATE_ASSIGNMENT"


def test_scan_attempt_link_not_found_writes_scan_and_operational_log() -> None:
    """After gate+identity, missing link: both audit rows (event is known)."""
    db = MagicMock()
    event_id = uuid.uuid4()
    assignment_id = uuid.uuid4()
    db.execute.return_value.first.return_value = (assignment_id, event_id)
    with mock.patch.object(VerificationService, "_find_link", return_value=None):
        service = VerificationService(
            db=db,
            identity=IdentityService(mosip=StubMOSIPAdapter()),
        )
        out = service.verify(
            '{"uin":"1234567890123456","name":"A"}', str(uuid.uuid4())
        )
    assert out.result == "deny"
    assert out.reason == DenialReasonEnum.LINK_NOT_FOUND
    assert db.add.call_count == 2
    scan_entry: ScanAttemptLog = db.add.call_args_list[0][0][0]
    op_log: Log = db.add.call_args_list[1][0][0]
    assert isinstance(scan_entry, ScanAttemptLog)
    assert isinstance(op_log, Log)
    assert scan_entry.denial_reason == DenialReasonEnum.LINK_NOT_FOUND
    assert op_log.denial_reason == DenialReasonEnum.LINK_NOT_FOUND


def test_scan_attempt_grant_both_rows() -> None:
    """Grant path: scan_attempt + operational log."""
    db = MagicMock()
    event_id = uuid.uuid4()
    assignment_id = uuid.uuid4()
    link_id = uuid.uuid4()
    ticket_id = uuid.uuid4()
    link_row = SimpleNamespace(link_id=link_id)
    with mock.patch.object(
        VerificationService, "_get_active_assignment", return_value=(assignment_id, event_id)
    ), mock.patch.object(VerificationService, "_find_link", return_value=link_row), mock.patch.object(
        VerificationService,
        "_find_ticket",
        return_value=SimpleNamespace(
            ticket_id=ticket_id, status=TicketStatusEnum.UNUSED
        ),
    ), mock.patch.object(VerificationService, "_mark_used", return_value=True):
        service = VerificationService(
            db=db,
            identity=IdentityService(mosip=StubMOSIPAdapter()),
        )
        out = service.verify(
            '{"uin":"1234567890123456","name":"A"}', str(uuid.uuid4())
        )
    assert out.result == "grant"
    assert out.ticket_id == str(ticket_id)
    assert db.add.call_count == 2
    scan_entry: ScanAttemptLog = db.add.call_args_list[0][0][0]
    op_log: Log = db.add.call_args_list[1][0][0]
    assert isinstance(scan_entry, ScanAttemptLog)
    assert isinstance(op_log, Log)
    assert scan_entry.result == ResultEnum.GRANTED
    assert scan_entry.denial_reason is None
    assert op_log.result == ResultEnum.GRANTED
