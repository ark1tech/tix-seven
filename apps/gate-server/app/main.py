from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.db.session import engine
from app.routers import health, issue, verify

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    logger.info("Database connectivity check passed.")
    yield


app = FastAPI(
    title="TixSeven Gate Server",
    description="Receives PhilSys QR payloads from ESP8266 gates and issues grant/deny decisions.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_methods=["POST", "GET"],
    allow_headers=["X-Gate-Api-Key", "Content-Type"],
)

app.include_router(health.router)
app.include_router(verify.router)
app.include_router(issue.router)
