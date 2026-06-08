from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.database import SessionLocal

from app.models.set import Set

router = APIRouter(
    prefix="/sets",
    tags=["Sets"]
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/")
def create_set(
    workout_exercise_id: int,
    reps: int | None = None,
    weight: float | None = None,
    duration_seconds: int | None = None,
    db: Session = Depends(get_db)
):
    new_set = Set(
        workout_exercise_id=workout_exercise_id,
        reps=reps,
        weight=weight,
        duration_seconds=duration_seconds,
        completed=False
    )

    db.add(new_set)
    db.commit()
    db.refresh(new_set)

    return new_set


@router.get("/workout-exercise/{workout_exercise_id}")
def get_sets(
    workout_exercise_id: int,
    db: Session = Depends(get_db)
):
    return db.query(Set).filter(
        Set.workout_exercise_id == workout_exercise_id
    ).all()


@router.patch("/{set_id}")
def update_set(
    set_id: int,
    reps: int | None = None,
    weight: float | None = None,
    duration_seconds: int | None = None,
    completed: bool | None = None,
    db: Session = Depends(get_db)
):
    current_set = db.query(Set).filter(
        Set.id == set_id
    ).first()

    if reps is not None:
        current_set.reps = reps

    if weight is not None:
        current_set.weight = weight

    if duration_seconds is not None:
        current_set.duration_seconds = duration_seconds

    if completed is not None:
        current_set.completed = completed

    db.commit()
    db.refresh(current_set)

    return current_set


@router.delete("/{set_id}")
def delete_set(
    set_id: int,
    db: Session = Depends(get_db)
):
    current_set = db.query(Set).filter(
        Set.id == set_id
    ).first()

    db.delete(current_set)

    db.commit()

    return {
        "message": "set deleted"
    }


@router.post("/bulk")
def bulk_create_sets(
    workout_exercise_id: int,
    amount: int,
    db: Session = Depends(get_db)
):
    created_sets = []

    for _ in range(amount):

        new_set = Set(
            workout_exercise_id=workout_exercise_id,
            completed=False
        )

        db.add(new_set)

        created_sets.append(new_set)

    db.commit()

    return created_sets

