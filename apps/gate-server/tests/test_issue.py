import logging
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

import app.dependencies as auth_dependencies
from app.adapters.mosip import MOSIPUnavailableError, StubMOSIPAdapter
from app.core.config import settings
from app.main import app
from app.db.time import PHT_NOW_SQL
from app.models.log import Log
from app.models.scan_attempt_log import ScanAttemptLog
from app.models.schemas import IssueResponse
from app.routers.issue import get_issuance_service
from app.models.event_ticket_link import EventTicketLink
from app.models.ticket import Ticket
from app.services.identity import IdentityService
from app.services.issuance import IssuanceService

_DASH = "/dashboard/tickets/issue"
_DASH_JSON = {"qr_payload": "{}", "event_id": str(uuid.uuid4())}


def test_issue_requires_api_key(client: TestClient):
    res = client.post(
        "/tickets/issue",
        json={"qr_payload": "{}", "event_id": str(uuid.uuid4())},
    )
    assert res.status_code == 401


def test_ticket_created_at_defaults_to_philippine_wall_clock() -> None:
    assert str(Ticket.__table__.c.created_at.server_default.arg) == PHT_NOW_SQL


def test_operational_log_defaults_to_philippine_wall_clock() -> None:
    assert str(Log.__table__.c.timestamp.server_default.arg) == PHT_NOW_SQL
    # `scan_attempt_log` uses database `now()`; operational `log` uses Philippine wall clock.
    assert str(ScanAttemptLog.__table__.c.timestamp.server_default.arg) == "now()"


def test_issue_empty_qr_400(
    client: TestClient,
    issue_auth_headers: dict,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
):
    # FakeSession has no Event row; skip DB event resolution so we hit identity verification.
    monkeypatch.setattr(
        IssuanceService,
        "_resolve_event",
        lambda self, ctx: ctx,
    )

    res = client.post(
        "/tickets/issue",
        json={"qr_payload": "", "event_id": str(uuid.uuid4())},
        headers=issue_auth_headers,
    )
    assert res.status_code == 400
    assert res.json()["detail"] == "identity_not_verified"
    assert "issue failed: reason=identity_not_verified" in caplog.text


def test_issue_missing_event_logs_reason(
    client: TestClient, issue_auth_headers: dict, caplog: pytest.LogCaptureFixture
) -> None:
    res = client.post(
        "/tickets/issue",
        json={"qr_payload": '{"uin":"x","name":"A"}', "event_id": str(uuid.uuid4())},
        headers=issue_auth_headers,
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "event_not_found"
    assert "issue failed: reason=event_not_found" in caplog.text


def test_issue_happy_path(
    client: TestClient, issue_auth_headers: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    tid, lid = uuid.uuid4(), uuid.uuid4()
    at = datetime.now(timezone.utc)

    def fake_issue(
        _self: IssuanceService, _qr: str, _eid: uuid.UUID
    ) -> IssueResponse:
        return IssueResponse(
            ticket_id=tid, link_id=lid, status="UNUSED", created_at=at
        )

    monkeypatch.setattr(IssuanceService, "issue", fake_issue)
    res = client.post(
        "/tickets/issue",
        json={"qr_payload": '{"uin":"x","name":"A"}', "event_id": str(uuid.uuid4())},
        headers=issue_auth_headers,
    )
    assert res.status_code == 201
    body = res.json()
    assert body["ticket_id"] == str(tid)
    assert body["link_id"] == str(lid)
    assert body["status"] == "UNUSED"


def test_issuance_duplicate_link_hash_409(caplog: pytest.LogCaptureFixture) -> None:
    db = MagicMock()

    db.scalar.return_value = SimpleNamespace()  # event exists

    def _flush() -> None:
        raise IntegrityError("stmt", {}, Exception())

    db.flush = _flush

    service = IssuanceService(
        db=db, identity=IdentityService(mosip=StubMOSIPAdapter())
    )
    with pytest.raises(HTTPException) as exc_info:
        service.issue('{"uin":"X","name":"A"}', uuid.uuid4())
    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "ticket_already_issued"
    db.rollback.assert_called_once()
    assert "issue failed: reason=ticket_already_issued" in caplog.text
    assert "Traceback" not in caplog.text


def test_issuance_success_logs_readable_outcome(caplog: pytest.LogCaptureFixture) -> None:
    """Full issuance path with a minimal fake session (no real DB)."""
    added: list[object] = []

    class FakeSession:
        def scalar(self, _stmt):
            return SimpleNamespace()

        def add(self, obj: object) -> None:
            added.append(obj)

        def flush(self) -> None:
            for obj in added:
                if isinstance(obj, EventTicketLink) and obj.link_id is None:
                    obj.link_id = uuid.uuid4()

        def commit(self) -> None:
            for obj in added:
                if isinstance(obj, Ticket):
                    if obj.ticket_id is None:
                        obj.ticket_id = uuid.uuid4()
                    if obj.created_at is None:
                        obj.created_at = datetime.now(timezone.utc)

        def rollback(self) -> None:
            return None

    eid = uuid.uuid4()
    service = IssuanceService(
        db=FakeSession(),  # type: ignore[arg-type]
        identity=IdentityService(mosip=StubMOSIPAdapter()),
    )
    with caplog.at_level(logging.INFO, logger="app.services.issuance"):
        result = service.issue('{"uin":"X","name":"A"}', eid)

    assert result.status == "UNUSED"
    assert "issue succeeded:" in caplog.text
    assert f"event_id={eid}" in caplog.text
    assert f"ticket_id={result.ticket_id}" in caplog.text
    assert f"link_id={result.link_id}" in caplog.text
    assert "status_code=201" in caplog.text
    assert "Traceback" not in caplog.text


def test_issuance_rolls_back_when_ticket_commit_fails(
    caplog: pytest.LogCaptureFixture,
) -> None:
    db = MagicMock()
    from types import SimpleNamespace

    db.scalar.return_value = SimpleNamespace()  # event exists
    db.commit.side_effect = SQLAlchemyError("commit failed")

    service = IssuanceService(
        db=db, identity=IdentityService(mosip=StubMOSIPAdapter())
    )

    with pytest.raises(HTTPException) as exc_info:
        service.issue('{"uin":"X","name":"A"}', uuid.uuid4())

    assert exc_info.value.status_code == 500
    assert exc_info.value.detail == "internal_server_error"
    db.rollback.assert_called_once()
    assert "issue failed: reason=persistence_failed" in caplog.text
    assert "error_type=" in caplog.text
    assert "Traceback" not in caplog.text


def test_issuance_mosip_unavailable_503(caplog: pytest.LogCaptureFixture) -> None:
    db = MagicMock()

    class FailingMOSIPAdapter:
        def verify(self, _qr_payload: str):
            raise MOSIPUnavailableError("network timeout")

    service = IssuanceService(
        db=db, identity=IdentityService(mosip=FailingMOSIPAdapter())
    )
    with pytest.raises(HTTPException) as exc_info:
        service.issue('{"uin":"X","name":"A"}', uuid.uuid4())

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == "mosip_unavailable"
    assert "issue failed: reason=mosip_unavailable" in caplog.text


def test_dashboard_missing_bearer_401(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    internal = "dash-int-" + "x" * 8
    monkeypatch.setattr(settings, "internal_api_key", internal)
    res = client.post(
        _DASH, json=_DASH_JSON, headers={"X-Internal-Api-Key": internal}
    )
    assert res.status_code == 401


def test_dashboard_invalid_bearer_401(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    internal = "dash-int-" + "y" * 8
    monkeypatch.setattr(settings, "internal_api_key", internal)
    monkeypatch.setattr(
        auth_dependencies,
        "verify_supabase_access_token",
        lambda *_a, **_kw: (_ for _ in ()).throw(ValueError("invalid token")),
    )
    res = client.post(
        _DASH,
        json=_DASH_JSON,
        headers={
            "X-Internal-Api-Key": internal,
            "Authorization": "Bearer invalid.token.value",
        },
    )
    assert res.status_code == 401


def test_dashboard_missing_internal_key_401(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "internal_api_key", "int-k-" + "z" * 8)
    res = client.post(
        _DASH,
        json=_DASH_JSON,
        headers={"Authorization": "Bearer any.token.value"},
    )
    assert res.status_code == 401


def test_dashboard_invalid_internal_key_401(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    internal = "valid-internal-key-12345"
    monkeypatch.setattr(settings, "internal_api_key", internal)
    res = client.post(
        _DASH,
        json=_DASH_JSON,
        headers={
            "X-Internal-Api-Key": "wrong-" + internal,
            "Authorization": "Bearer any.token.value",
        },
    )
    assert res.status_code == 401


def test_dashboard_hardware_key_only_401(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Valid X-Gate-Api-Key (hardware) must not unlock dashboard; internal+JWT required."""
    monkeypatch.setattr(settings, "internal_api_key", "sep-internal-" + "a" * 8)
    res = client.post(
        _DASH,
        json=_DASH_JSON,
        headers={"X-Gate-Api-Key": settings.effective_hardware_api_key},
    )
    assert res.status_code == 401


def test_dashboard_internal_and_jwt_201(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """POST /dashboard/tickets/issue with X-Internal-Api-Key + valid Bearer returns 201."""
    internal = "dash-201-" + "j" * 8
    monkeypatch.setattr(settings, "internal_api_key", internal)
    tid, lid = uuid.uuid4(), uuid.uuid4()
    at = datetime.now(timezone.utc)

    def fake_issue(
        _self: IssuanceService, _qr: str, _eid: uuid.UUID
    ) -> IssueResponse:
        return IssueResponse(
            ticket_id=tid, link_id=lid, status="UNUSED", created_at=at
        )

    monkeypatch.setattr(IssuanceService, "issue", fake_issue)
    monkeypatch.setattr(
        auth_dependencies,
        "verify_supabase_access_token",
        lambda *_a, **_kw: {"sub": "user-1", "exp": 9_999_999_999},
    )
    res = client.post(
        _DASH,
        json=_DASH_JSON,
        headers={
            "X-Internal-Api-Key": internal,
            "Authorization": "Bearer eyJ.happy.path.mock",
        },
    )
    assert res.status_code == 201
    body = res.json()
    assert body["ticket_id"] == str(tid)
    assert body["link_id"] == str(lid)
    assert body["status"] == "UNUSED"
