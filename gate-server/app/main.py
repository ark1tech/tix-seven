from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import health, verify


@asynccontextmanager
async def lifespan(app: FastAPI):
    # TODO: add startup checks (DB connectivity, MOSIP reachability) here
    yield
    # TODO: add graceful shutdown logic here if needed


app = FastAPI(
    title="TixSeven Gate Server",
    description="Receives PhilSys QR payloads from ESP8266 gates and issues grant/deny decisions.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to known ESP8266 IPs in production
    allow_methods=["POST", "GET"],
    allow_headers=["X-Gate-Api-Key", "Content-Type"],
)

app.include_router(health.router)
app.include_router(verify.router)
