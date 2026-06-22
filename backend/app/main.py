from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.database.database import engine, Base
import app.models

from app.routers.exercises import router as exercises_router
from app.routers.plans import router as plans_router
from app.routers.workouts import router as workouts_router
from app.routers.sets import router as sets_router
from app.routers.workout_exercises import router as workout_exercises_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(exercises_router, prefix="/api")
app.include_router(plans_router, prefix="/api")
app.include_router(workouts_router, prefix="/api")
app.include_router(sets_router, prefix="/api")
app.include_router(workout_exercises_router)


def ensure_database_schema():
    schema_updates = [
        """
        ALTER TABLE plan_days
        ADD COLUMN IF NOT EXISTS workout_type VARCHAR DEFAULT 'normal'
        """,
        """
        ALTER TABLE plan_days
        ADD COLUMN IF NOT EXISTS circuit_rest_seconds INTEGER DEFAULT 90
        """,
        """
        ALTER TABLE workouts
        ADD COLUMN IF NOT EXISTS workout_type VARCHAR DEFAULT 'normal'
        """,
        """
        ALTER TABLE workouts
        ADD COLUMN IF NOT EXISTS circuit_rest_seconds INTEGER DEFAULT 90
        """,
    ]

    with engine.begin() as connection:
        for statement in schema_updates:
            connection.execute(text(statement))


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    ensure_database_schema()


@app.get("/api/health")
def health():
    return {"status": "ok"}
