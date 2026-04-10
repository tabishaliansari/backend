from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import Base, engine
from app.db import base
from app.api.routes.auth import router as auth
from app.api.routes.health import router as health
from app.api.routes.users import router as users
from app.api.limiter import limiter
from app.utils.api_error import register_exception_handlers
from app.core.config import settings

app = FastAPI(title="FastAPI Auth")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",      # Vite dev server
        "http://127.0.0.1:5173",      # Alternative localhost
        "http://localhost:3000",      # For production build
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(health)
app.include_router(auth)
app.include_router(users)

app.state.limiter = limiter

# Register exception handlers
register_exception_handlers(app)


@app.get("/")
def root():
    return {"message": "FastAPI auth service is running"}


if __name__ == "__main__":
    import uvicorn

    port = settings.PORT
    host = "127.0.0.1"

    print(f"🚀 Starting server on http://{host}:{port}")
    uvicorn.run(app, host=host, port=port)