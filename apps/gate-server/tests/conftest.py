import pytest
from fastapi.testclient import TestClient

from app.adapters.mosip import StubMOSIPAdapter
from app.core.config import settings
from app.main import app
from app.routers.verify import get_verification_service
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
    return VerificationService(db=FakeSession(), mosip=StubMOSIPAdapter())


@pytest.fixture
def client() -> TestClient:
    app.dependency_overrides[get_verification_service] = _stub_service
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers() -> dict:
    return {"X-Gate-Api-Key": settings.gate_api_key}
