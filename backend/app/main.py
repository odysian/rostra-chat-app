from app.api import auth, messages, rooms
from app.core.config import settings
from app.core.database import Base, engine, get_db
from app.core.logging import logger
from app.websocket.handlers import websocket_endpoint
from fastapi import Depends, FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

logger.info("Starting ChatApp API")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    swagger_ui_parameters={"persistAuthorization": True},
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
