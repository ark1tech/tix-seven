import uuid
from types import SimpleNamespace
from fastapi.testclient import TestClient

from app.models.enums import TicketStatusEnum
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
    assert body["reason"] == "invalid_id"


def test_verify_no_ticket_returns_deny(
    client: TestClient, auth_headers: dict, monkeypatch
):
    event_id = uuid.uuid4()
    monkeypatch.setattr(VerificationService, "_get_event_id_for_gate", lambda *_: event_id)
    monkeypatch.setattr(VerificationService, "_find_ticket", lambda *_: None)

    res = client.post(
        "/verify",
        json={"qr_payload": "valid-qr-payload", "gate_id": str(uuid.uuid4())},
        headers=auth_headers,
    )
    body = res.json()
    assert body["result"] == "deny"
    assert body["reason"] == "no_ticket"


def test_verify_already_used_returns_deny(
    client: TestClient, auth_headers: dict, monkeypatch
):
    event_id = uuid.uuid4()
    used_ticket = SimpleNamespace(ticket_id=uuid.uuid4(), status=TicketStatusEnum.USED)
    monkeypatch.setattr(VerificationService, "_get_event_id_for_gate", lambda *_: event_id)
    monkeypatch.setattr(VerificationService, "_find_ticket", lambda *_: used_ticket)

    res = client.post(
        "/verify",
        json={"qr_payload": "valid-qr-payload", "gate_id": str(uuid.uuid4())},
        headers=auth_headers,
    )
    body = res.json()
    assert body["result"] == "deny"
    assert body["reason"] == "already_used"


def test_verify_grant_marks_ticket_used(
    client: TestClient, auth_headers: dict, monkeypatch
):
    event_id = uuid.uuid4()
    unused_ticket = SimpleNamespace(ticket_id=uuid.uuid4(), status=TicketStatusEnum.UNUSED)
    monkeypatch.setattr(VerificationService, "_get_event_id_for_gate", lambda *_: event_id)
    monkeypatch.setattr(VerificationService, "_find_ticket", lambda *_: unused_ticket)
    monkeypatch.setattr(VerificationService, "_mark_used", lambda *_: True)

    res = client.post(
        "/verify",
        json={"qr_payload": "valid-qr-payload", "gate_id": str(uuid.uuid4())},
        headers=auth_headers,
    )
    body = res.json()
    assert body["result"] == "grant"
    assert body["ticket_id"] == str(unused_ticket.ticket_id)
    assert body["reason"] is None


def test_verify_wrong_event_returns_deny(
    client: TestClient, auth_headers: dict, monkeypatch
):
    monkeypatch.setattr(VerificationService, "_get_event_id_for_gate", lambda *_: None)

    res = client.post(
        "/verify",
        json={"qr_payload": "valid-qr-payload", "gate_id": str(uuid.uuid4())},
        headers=auth_headers,
    )
    body = res.json()
    assert body["result"] == "deny"
    assert body["reason"] == "wrong_event"
