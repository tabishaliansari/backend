from fastapi import FastAPI

from db.database import Base, engine
from db import base
from api.routes.auth_controller import router as auth_router

app = FastAPI(title="FastAPI Auth")

Base.metadata.create_all(bind=engine)

app.include_router(auth_router)


@app.get("/")
def root():
    return {"message": "FastAPI auth service is running"}