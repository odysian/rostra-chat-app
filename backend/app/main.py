from contextlib import asynccontextmanager

from app.api import auth, messages, rooms
from app.core.config import settings
from app.core.database import Base, engine, get_db
from app.core.logging import logger
from app.core.rate_limit import limiter
from app.core.redis import init_redis
from app.websocket.handlers import websocket_endpoint
from fastapi import Depends, FastAPI, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy.orm import Session

logger.info("Starting ChatApp API")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan events: startup and shutdown."""
    init_redis()
    yield
    # Shutdown: Redis client does not require explicit close for basic usage


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
    allow_methods=["*"],
    allow_headers=["*"],
)


# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    return response


# Routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(rooms.router, prefix=f"{settings.API_V1_STR}/rooms", tags=["rooms"])
app.include_router(messages.router, prefix=settings.API_V1_STR, tags=["messages"])


@app.get("/")
def root():
    """Health check endpoint"""
    return {"message": "Chat API is running"}


@app.websocket("/ws/connect")
async def websocket_route(
    websocket: WebSocket, token: str, db: Session = Depends(get_db)
):
    await websocket_endpoint(websocket, token, db)
