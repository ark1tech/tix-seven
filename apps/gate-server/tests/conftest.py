import pytest
from fastapi.testclient import TestClient

from app.adapters.mosip import StubMOSIPAdapter
from app.core.config import settings
from app.main import app
from app.routers.issue import get_issuance_service
from app.routers.verify import get_verification_service
from app.services.identity import IdentityService
from app.services.issuance import IssuanceService
from app.services.verification import VerificationService


class FakeSession:
    def scalar(self, _stmt):
        return None

    def execute(self, _stmt):
        class _Result:
            rowcount = 0

        return _Result()

    def add(self, _obj):
        return None

    def commit(self):
        return None

    def rollback(self):
        return None


def _stub_service():
    return VerificationService(
        db=FakeSession(),
        identity=IdentityService(mosip=StubMOSIPAdapter()),
    )


def _stub_issuance():
    return IssuanceService(
        db=FakeSession(),
        identity=IdentityService(mosip=StubMOSIPAdapter()),
    )


@pytest.fixture
def client() -> TestClient:
    app.dependency_overrides[get_verification_service] = _stub_service
    app.dependency_overrides[get_issuance_service] = _stub_issuance
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers() -> dict:
    """X-Gate-Api-Key for /verify (hardware key)."""
    return {"X-Gate-Api-Key": settings.gate_hardware_api_key}
