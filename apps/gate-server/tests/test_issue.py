import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from app.adapters.mosip import StubMOSIPAdapter
from app.main import app
from app.models.schemas import IssueResponse
from app.routers.issue import get_issuance_service
from app.services.issuance import IssuanceService


def test_issue_requires_api_key(client: TestClient):
    res = client.post(
        "/tickets/issue",
        json={"qr_payload": "{}", "event_id": str(uuid.uuid4())},
    )
    assert res.status_code == 403


def test_issue_empty_qr_400(client: TestClient, auth_headers: dict):
    res = client.post(
        "/tickets/issue",
        json={"qr_payload": "", "event_id": str(uuid.uuid4())},
        headers=auth_headers,
    )
    assert res.status_code == 400
    assert res.json()["detail"] == "identity_not_verified"


def test_issue_happy_path(
    client: TestClient, auth_headers: dict, monkeypatch: pytest.MonkeyPatch
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
        headers=auth_headers,
    )
    assert res.status_code == 201
    body = res.json()
    assert body["ticket_id"] == str(tid)
    assert body["link_id"] == str(lid)
    assert body["status"] == "UNUSED"


def test_issuance_duplicate_link_hash_409() -> None:
    db = MagicMock()
    from types import SimpleNamespace

    db.scalar.return_value = SimpleNamespace()  # event exists

    def _flush() -> None:
        raise IntegrityError("stmt", {}, Exception())

    db.flush = _flush

    service = IssuanceService(db=db, mosip=StubMOSIPAdapter())
    with pytest.raises(HTTPException) as exc_info:
        service.issue('{"uin":"X","name":"A"}', uuid.uuid4())
    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "ticket_already_issued"
    db.rollback.assert_called_once()
