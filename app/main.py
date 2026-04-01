from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import Base, engine
from app.db import base
from app.api.routes.auth import router as auth
from app.api.routes.health import router as health
from app.api.limiter import limiter
from app.utils.api_error import register_exception_handlers

app = FastAPI(title="FastAPI Auth")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Base.metadata.create_all(bind=engine)

app.include_router(auth)
app.include_router(health)

app.state.limiter = limiter

# Register exception handlers
register_exception_handlers(app)


@app.get("/")
def root():
    return {"message": "FastAPI auth service is running"}