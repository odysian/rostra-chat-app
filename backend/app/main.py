from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api import auth, messages, rooms
from app.core.config import settings
from app.core.database import async_engine
from app.core.logging import logger
from app.core.rate_limit import limiter
from app.core.redis import close_redis, init_redis
from app.websocket.handlers import websocket_endpoint

logger.info("Starting ChatApp API")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan events: startup and shutdown."""
    await init_redis()
    yield
    await close_redis()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    swagger_ui_parameters={"persistAuthorization": True},
    lifespan=lifespan,
)

# Rate limiting (slowapi)
app.state.limiter = limiter
app.add_middleware(
    SlowAPIMiddleware,
)


async def rate_limit_exceeded_handler(request: Request, exc: Exception) -> Response:
    """
    Adapter so SlowAPI's handler (expects RateLimitExceeded)
    matches FastAPI's ExceptionHandler type (expects Exception).
    FastAPI will only call this for RateLimitExceeded because of the key.
    """
    assert isinstance(exc, RateLimitExceeded)
    return _rate_limit_exceeded_handler(request, exc)


app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Strict-Transport-Security"] = (
        "max-age=63072000; includeSubDomains; preload"
    )
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["X-XSS-Protection"] = "0"
    return response


# Routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(rooms.router, prefix=f"{settings.API_V1_STR}/rooms", tags=["rooms"])
app.include_router(messages.router, prefix=settings.API_V1_STR, tags=["messages"])


@app.get("/")
def root():
    """Health check endpoint"""
    return {"message": "Chat API is running"}


@app.get(f"{settings.API_V1_STR}/health/db")
async def db_health():
    """Return database connection pool health metrics for operational monitoring."""
    pool = async_engine.pool
    pool_size = pool.size()  # type: ignore
    checked_out = pool.checkedout()  # type: ignore
    overflow = pool.overflow()  # type: ignore

    return {
        "pool_size": pool_size,
        "checked_out": checked_out,
        "overflow": overflow,
        "status": "healthy" if pool_size > 0 else "degraded",
    }


@app.websocket("/ws/connect")
async def websocket_route(websocket: WebSocket, token: str):
    await websocket_endpoint(websocket, token)
