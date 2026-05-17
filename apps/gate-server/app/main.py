from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exception_handlers import (
    http_exception_handler,
    request_validation_exception_handler,
)
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy import text

from app.core.trace import end_trace_context, start_trace_context
from app.db.session import engine
from app.routers import health, issue, verify
from app.routers import events as events_router
from app.routers import gates as gates_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Database check
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    logger.info("Database connectivity check passed.")

    # Eagerly initialize MOSIP Authenticator to catch credential/crypto hangs at startup
    from app.adapters.mosip import RealMOSIPAdapter

    try:
        _ = RealMOSIPAdapter()
    except Exception as e:
        logger.error("Failed to initialize MOSIP Authenticator: %s", str(e))
        # We don't raise here to allow the server to start (e.g. for health checks),
        # but the error will be visible in the logs.

    yield


app = FastAPI(
    title="TixSeven Gate Server",
    description="Receives PhilSys QR payloads from ESP8266 gates and issues grant/deny decisions.",
    version="0.1.0",
    lifespan=lifespan,
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Log unexpected errors with trace correlation. HTTPException uses the default handler.
    """

    if isinstance(exc, (HTTPException, StarletteHTTPException)):
        return await http_exception_handler(request, exc)

    if isinstance(exc, RequestValidationError):
        return await request_validation_exception_handler(request, exc)

    trace_id = getattr(request.state, "trace_id", None) or request.headers.get(
        "X-Trace-Id",
        "-",
    )

    logger.error(
        "unhandled exception: trace_id=%s exc_type=%s",
        trace_id,
        type(exc).__name__,
        exc_info=exc,
    )

    return JSONResponse(
        status_code=500,
        content={"detail": "internal_server_error"},
        headers={"X-Trace-Id": trace_id},
    )


@app.middleware("http")
async def attach_trace_id(request: Request, call_next):
    token, trace_id = start_trace_context(request.headers.get("X-Trace-Id"))
    request.state.trace_id = trace_id
    logger.info(
        "pipeline ingress: trace_id=%s method=%s path=%s",
        trace_id,
        request.method,
        request.url.path,
    )
    try:
        response = await call_next(request)
        response.headers["X-Trace-Id"] = trace_id
        logger.info(
            "pipeline egress: trace_id=%s method=%s path=%s status_code=%s",
            trace_id,
            request.method,
            request.url.path,
            response.status_code,
        )
        return response
    finally:
        end_trace_context(token)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_methods=["POST", "GET"],
    allow_headers=[
        "X-Gate-Api-Key",
        "X-Internal-Api-Key",
        "Authorization",
        "X-Trace-Id",
        "Content-Type",
    ],
)

app.include_router(health.router)
app.include_router(verify.router)
app.include_router(issue.router)
app.include_router(events_router.router)
app.include_router(gates_router.router)
