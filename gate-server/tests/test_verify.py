"""
Verification endpoint tests.
These stubs are scaffolded per the PRD testing decisions.
Implement each TODO as VerificationService is built out.
"""

import pytest
from fastapi.testclient import TestClient


def test_health(client: TestClient):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_verify_requires_api_key(client: TestClient):
    res = client.post("/verify", json={"qr_payload": "test", "gate_id": "gate-1"})
    assert res.status_code == 403


def test_verify_invalid_qr_returns_deny(client: TestClient, auth_headers: dict):
    # TODO: mock StubMOSIPAdapter to return verified=False for empty payload
    res = client.post(
        "/verify",
        json={"qr_payload": "", "gate_id": "gate-1"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["result"] == "deny"
    assert body["reason"] == "invalid_id"


@pytest.mark.skip(reason="Requires DB — implement after _get_event_id_for_gate")
def test_verify_no_ticket_returns_deny(client: TestClient, auth_headers: dict):
    # TODO: seed a gate assigned to an event, use a UIN with no ticket
    res = client.post(
        "/verify",
        json={"qr_payload": "valid-qr-payload", "gate_id": "seeded-gate-id"},
        headers=auth_headers,
    )
    body = res.json()
    assert body["result"] == "deny"
    assert body["reason"] == "no_ticket"


@pytest.mark.skip(reason="Requires DB — implement after _find_ticket")
def test_verify_already_used_returns_deny(client: TestClient, auth_headers: dict):
    # TODO: seed a gate + used ticket, verify same UIN twice
    pass


@pytest.mark.skip(reason="Requires DB — implement after _mark_used")
def test_verify_grant_marks_ticket_used(client: TestClient, auth_headers: dict):
    # TODO: seed a gate + unused ticket, verify, check DB status is 'used'
    pass


@pytest.mark.skip(reason="Requires DB — implement after _get_event_id_for_gate")
def test_verify_wrong_event_returns_deny(client: TestClient, auth_headers: dict):
    # TODO: gate assigned to Event A, ticket is for Event B
    pass
