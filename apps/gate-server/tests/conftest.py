import pytest
from fastapi.testclient import TestClient

from app.adapters.mosip import StubMOSIPAdapter
from app.core.config import settings
from app.main import app
from app.routers.verify import get_verification_service
from app.services.verification import VerificationService


def _stub_service():
    return VerificationService(mosip=StubMOSIPAdapter())


@pytest.fixture
def client() -> TestClient:
    app.dependency_overrides[get_verification_service] = _stub_service
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers() -> dict:
    return {"X-Gate-Api-Key": settings.gate_api_key}
