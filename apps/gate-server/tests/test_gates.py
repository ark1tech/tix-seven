import uuid
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

import app.dependencies as auth_dependencies
from app.core.config import settings
from app.main import app
from app.models.schemas import GateCreateRequest, GateResponse, GateUpdateRequest
from app.routers.gates import get_gate_service
from app.services.gates import GateService

_BASE = "/dashboard/gates"
_GATE_ID = uuid.uuid4()
_VENUE_ID = uuid.uuid4()
_EVENT_ID = uuid.uuid4()

_CREATE_JSON = {"location": "Gate A"}

_RESPONSE = GateResponse(
    gate_id=_GATE_ID,
    venue_id=_VENUE_ID,
    location="Gate A",
    status="OFFLINE",
    event_id=None,
)

_INTERNAL = "test-internal-key-gates"
_AUTH_HEADERS = {
    "X-Internal-Api-Key": _INTERNAL,
    "Authorization": "Bearer eyJ.happy.path.mock",
}


def _fake_jwt(*_a, **_kw):
    return {"sub": "user-1", "exp": 9_999_999_999}


@pytest.fixture
def client_with_service(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setattr(settings, "internal_api_key", _INTERNAL)
    monkeypatch.setattr(auth_dependencies, "verify_supabase_access_token", _fake_jwt)

    mock_service = MagicMock(spec=GateService)
    mock_service.create.return_value = _RESPONSE
    mock_service.update.return_value = _RESPONSE
    mock_service.delete.return_value = None

    app.dependency_overrides[get_gate_service] = lambda: mock_service
    client = TestClient(app)
    yield client, mock_service
    app.dependency_overrides.pop(get_gate_service, None)


@pytest.fixture
def bare_client() -> TestClient:
    app.dependency_overrides[get_gate_service] = lambda: MagicMock(spec=GateService)
    client = TestClient(app)
    yield client
    app.dependency_overrides.pop(get_gate_service, None)


# ---------------------------------------------------------------------------
# Auth guard tests
# ---------------------------------------------------------------------------

def test_create_gate_missing_internal_key_401(
    bare_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "internal_api_key", "real-key-12345")
    res = bare_client.post(
        _BASE,
        json=_CREATE_JSON,
        headers={"Authorization": "Bearer any.token.value"},
    )
    assert res.status_code == 401


def test_create_gate_missing_bearer_401(
    bare_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "internal_api_key", "real-key-12345")
    res = bare_client.post(
        _BASE,
        json=_CREATE_JSON,
        headers={"X-Internal-Api-Key": "real-key-12345"},
    )
    assert res.status_code == 401


def test_create_gate_invalid_bearer_401(
    bare_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "internal_api_key", "real-key-12345")
    monkeypatch.setattr(
        auth_dependencies,
        "verify_supabase_access_token",
        lambda *_a, **_kw: (_ for _ in ()).throw(ValueError("invalid")),
    )
    res = bare_client.post(
        _BASE,
        json=_CREATE_JSON,
        headers={
            "X-Internal-Api-Key": "real-key-12345",
            "Authorization": "Bearer bad.token.value",
        },
    )
    assert res.status_code == 401


def test_patch_gate_missing_internal_key_401(
    bare_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "internal_api_key", "real-key-12345")
    res = bare_client.patch(
        f"{_BASE}/{_GATE_ID}",
        json={"location": "Updated"},
        headers={"Authorization": "Bearer any.token.value"},
    )
    assert res.status_code == 401


def test_patch_gate_missing_bearer_401(
    bare_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "internal_api_key", "real-key-12345")
    res = bare_client.patch(
        f"{_BASE}/{_GATE_ID}",
        json={"location": "Updated"},
        headers={"X-Internal-Api-Key": "real-key-12345"},
    )
    assert res.status_code == 401


def test_delete_gate_missing_internal_key_401(
    bare_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "internal_api_key", "real-key-12345")
    res = bare_client.delete(
        f"{_BASE}/{_GATE_ID}",
        headers={"Authorization": "Bearer any.token.value"},
    )
    assert res.status_code == 401


def test_delete_gate_missing_bearer_401(
    bare_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "internal_api_key", "real-key-12345")
    res = bare_client.delete(
        f"{_BASE}/{_GATE_ID}",
        headers={"X-Internal-Api-Key": "real-key-12345"},
    )
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------

def test_create_gate_201(client_with_service) -> None:
    client, mock_service = client_with_service
    res = client.post(_BASE, json=_CREATE_JSON, headers=_AUTH_HEADERS)
    assert res.status_code == 201
    body = res.json()
    assert body["gate_id"] == str(_GATE_ID)
    assert body["location"] == "Gate A"
    assert body["status"] == "OFFLINE"
    mock_service.create.assert_called_once()


def test_create_gate_with_event_id_201(client_with_service) -> None:
    client, mock_service = client_with_service
    mock_service.create.return_value = GateResponse(
        gate_id=_GATE_ID,
        venue_id=_VENUE_ID,
        location="Gate A",
        status="OFFLINE",
        event_id=_EVENT_ID,
    )
    res = client.post(
        _BASE,
        json={"location": "Gate A", "event_id": str(_EVENT_ID)},
        headers=_AUTH_HEADERS,
    )
    assert res.status_code == 201
    assert res.json()["event_id"] == str(_EVENT_ID)


def test_patch_gate_200(client_with_service) -> None:
    client, mock_service = client_with_service
    res = client.patch(
        f"{_BASE}/{_GATE_ID}",
        json={"location": "Updated Gate"},
        headers=_AUTH_HEADERS,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["gate_id"] == str(_GATE_ID)
    mock_service.update.assert_called_once()


def test_patch_gate_empty_body_no_op_200(client_with_service) -> None:
    """Empty PATCH body is valid and returns 200."""
    client, mock_service = client_with_service
    res = client.patch(f"{_BASE}/{_GATE_ID}", json={}, headers=_AUTH_HEADERS)
    assert res.status_code == 200
    mock_service.update.assert_called_once()


def test_delete_gate_204(client_with_service) -> None:
    client, mock_service = client_with_service
    res = client.delete(f"{_BASE}/{_GATE_ID}", headers=_AUTH_HEADERS)
    assert res.status_code == 204
    mock_service.delete.assert_called_once_with(_GATE_ID)


# ---------------------------------------------------------------------------
# 404
# ---------------------------------------------------------------------------

def test_patch_gate_not_found_404(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "internal_api_key", _INTERNAL)
    monkeypatch.setattr(auth_dependencies, "verify_supabase_access_token", _fake_jwt)

    mock_service = MagicMock(spec=GateService)
    mock_service.update.side_effect = HTTPException(status_code=404, detail="gate_not_found")

    app.dependency_overrides[get_gate_service] = lambda: mock_service
    try:
        client = TestClient(app)
        res = client.patch(
            f"{_BASE}/{uuid.uuid4()}",
            json={"location": "X"},
            headers=_AUTH_HEADERS,
        )
        assert res.status_code == 404
        assert res.json()["detail"] == "gate_not_found"
    finally:
        app.dependency_overrides.pop(get_gate_service, None)


def test_delete_gate_not_found_404(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "internal_api_key", _INTERNAL)
    monkeypatch.setattr(auth_dependencies, "verify_supabase_access_token", _fake_jwt)

    mock_service = MagicMock(spec=GateService)
    mock_service.delete.side_effect = HTTPException(status_code=404, detail="gate_not_found")

    app.dependency_overrides[get_gate_service] = lambda: mock_service
    try:
        client = TestClient(app)
        res = client.delete(f"{_BASE}/{uuid.uuid4()}", headers=_AUTH_HEADERS)
        assert res.status_code == 404
        assert res.json()["detail"] == "gate_not_found"
    finally:
        app.dependency_overrides.pop(get_gate_service, None)


# ---------------------------------------------------------------------------
# 409
# ---------------------------------------------------------------------------

def test_delete_gate_in_use_409(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "internal_api_key", _INTERNAL)
    monkeypatch.setattr(auth_dependencies, "verify_supabase_access_token", _fake_jwt)

    mock_service = MagicMock(spec=GateService)
    mock_service.delete.side_effect = HTTPException(status_code=409, detail="gate_in_use")

    app.dependency_overrides[get_gate_service] = lambda: mock_service
    try:
        client = TestClient(app)
        res = client.delete(f"{_BASE}/{_GATE_ID}", headers=_AUTH_HEADERS)
        assert res.status_code == 409
        assert res.json()["detail"] == "gate_in_use"
    finally:
        app.dependency_overrides.pop(get_gate_service, None)
