import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from app.adapters.mosip import MOSIPUnavailableError
from app.models.enums import DenialReasonEnum, ResultEnum, TicketStatusEnum
from app.models.log import Log
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

    service = VerificationService(db=db, mosip=TimingOutMOSIP())
    response = service.verify('{"uin":"1234567890123456"}', str(uuid.uuid4()))

    assert response.result == "deny"
    assert response.reason == DenialReasonEnum.SERVER_TIMEOUT

    db.rollback.assert_called_once()
    db.commit.assert_called_once()

    db.add.assert_called_once()
    log_entry: Log = db.add.call_args[0][0]
    assert isinstance(log_entry, Log)
    assert log_entry.result == ResultEnum.DENIED
    assert log_entry.denial_reason == DenialReasonEnum.SERVER_TIMEOUT
