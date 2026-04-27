import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

import app.dependencies as auth_dependencies
from app.core.config import settings
from app.main import app
from app.models.schemas import EventCreateRequest, EventResponse, EventUpdateRequest
from app.routers.events import get_event_service
from app.services.events import EventService

_BASE = "/dashboard/events"
_EVENT_ID = uuid.uuid4()
_NOW = datetime.now(timezone.utc)

_CREATE_JSON = {
    "name": "Test Event",
    "start_time": "2026-06-01T09:00:00Z",
    "end_time": "2026-06-01T18:00:00Z",
    "venue_name": "Main Hall",
    "capacity": 500,
}

_RESPONSE = EventResponse(
    event_id=_EVENT_ID,
    venue_id=uuid.uuid4(),
    venue_name="Main Hall",
    name="Test Event",
    start_time=_NOW,
    end_time=_NOW,
    capacity=500,
)

_INTERNAL = "test-internal-key-events"
_AUTH_HEADERS = {
    "X-Internal-Api-Key": _INTERNAL,
    "Authorization": "Bearer eyJ.happy.path.mock",
}


def _fake_jwt(*_a, **_kw):
    return {"sub": "user-1", "exp": 9_999_999_999}


@pytest.fixture
def client_with_service(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """Client with auth patched and a MagicMock event service."""
    monkeypatch.setattr(settings, "internal_api_key", _INTERNAL)
    monkeypatch.setattr(auth_dependencies, "verify_supabase_access_token", _fake_jwt)

    mock_service = MagicMock(spec=EventService)
    mock_service.create.return_value = _RESPONSE
    mock_service.update.return_value = _RESPONSE

    app.dependency_overrides[get_event_service] = lambda: mock_service
    client = TestClient(app)
    yield client, mock_service
    app.dependency_overrides.pop(get_event_service, None)


# ---------------------------------------------------------------------------
# Auth guard tests
# ---------------------------------------------------------------------------

@pytest.fixture
def bare_client() -> TestClient:
    app.dependency_overrides[get_event_service] = lambda: MagicMock(spec=EventService)
    client = TestClient(app)
    yield client
    app.dependency_overrides.pop(get_event_service, None)


def test_create_event_missing_internal_key_401(
    bare_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "internal_api_key", "real-key-12345")
    res = bare_client.post(
        _BASE,
        json=_CREATE_JSON,
        headers={"Authorization": "Bearer any.token.value"},
    )
    assert res.status_code == 401


def test_create_event_missing_bearer_401(
    bare_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "internal_api_key", "real-key-12345")
    res = bare_client.post(
        _BASE,
        json=_CREATE_JSON,
        headers={"X-Internal-Api-Key": "real-key-12345"},
    )
    assert res.status_code == 401


def test_create_event_invalid_bearer_401(
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


def test_patch_event_missing_internal_key_401(
    bare_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "internal_api_key", "real-key-12345")
    res = bare_client.patch(
        f"{_BASE}/{_EVENT_ID}",
        json={"name": "Updated"},
        headers={"Authorization": "Bearer any.token.value"},
    )
    assert res.status_code == 401


def test_patch_event_missing_bearer_401(
    bare_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "internal_api_key", "real-key-12345")
    res = bare_client.patch(
        f"{_BASE}/{_EVENT_ID}",
        json={"name": "Updated"},
        headers={"X-Internal-Api-Key": "real-key-12345"},
    )
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------

def test_create_event_201(client_with_service) -> None:
    client, mock_service = client_with_service
    res = client.post(_BASE, json=_CREATE_JSON, headers=_AUTH_HEADERS)
    assert res.status_code == 201
    body = res.json()
    assert body["event_id"] == str(_RESPONSE.event_id)
    assert body["name"] == "Test Event"
    mock_service.create.assert_called_once()


def test_patch_event_200(client_with_service) -> None:
    client, mock_service = client_with_service
    res = client.patch(
        f"{_BASE}/{_EVENT_ID}",
        json={"name": "Updated Name"},
        headers=_AUTH_HEADERS,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["event_id"] == str(_RESPONSE.event_id)
    mock_service.update.assert_called_once()


def test_patch_event_empty_body_no_op_200(client_with_service) -> None:
    """Empty PATCH body is valid and returns 200."""
    client, mock_service = client_with_service
    res = client.patch(f"{_BASE}/{_EVENT_ID}", json={}, headers=_AUTH_HEADERS)
    assert res.status_code == 200
    mock_service.update.assert_called_once()


# ---------------------------------------------------------------------------
# 404
# ---------------------------------------------------------------------------

def test_patch_event_not_found_404(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "internal_api_key", _INTERNAL)
    monkeypatch.setattr(auth_dependencies, "verify_supabase_access_token", _fake_jwt)

    mock_service = MagicMock(spec=EventService)
    mock_service.update.side_effect = HTTPException(status_code=404, detail="event_not_found")

    app.dependency_overrides[get_event_service] = lambda: mock_service
    try:
        client = TestClient(app)
        res = client.patch(
            f"{_BASE}/{uuid.uuid4()}",
            json={"name": "X"},
            headers=_AUTH_HEADERS,
        )
        assert res.status_code == 404
        assert res.json()["detail"] == "event_not_found"
    finally:
        app.dependency_overrides.pop(get_event_service, None)
