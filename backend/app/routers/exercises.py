from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.models.exercise import Exercise
from app.models.plan import PlanExercise
from app.models.workout import WorkoutExercise
from app.schemas.exercise import ExerciseCreate

router = APIRouter(
    prefix="/exercises",
    tags=["Exercises"]
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/")
def get_exercises(db: Session = Depends(get_db)):
    return db.query(Exercise).all()


@router.post("/")
def create_exercise(
    exercise_data: ExerciseCreate,
    db: Session = Depends(get_db)
):
    exercise = Exercise(
        name=exercise_data.name,
        muscle_group=exercise_data.muscle_group,
    )

    db.add(exercise)
    db.commit()
    db.refresh(exercise)

    return exercise


@router.get("/{exercise_id}")
def get_exercise(
    exercise_id: int,
    db: Session = Depends(get_db)
):
    return db.query(Exercise).filter(
        Exercise.id == exercise_id
    ).first()


@router.delete("/{exercise_id}")
def delete_exercise(
    exercise_id: int,
    db: Session = Depends(get_db)
):
    exercise = db.query(Exercise).filter(
        Exercise.id == exercise_id
    ).first()

    if not exercise:
        raise HTTPException(
            status_code=404,
            detail="Exercise not found"
        )

    workout_usage = db.query(WorkoutExercise).filter(
        WorkoutExercise.exercise_id == exercise_id
    ).first()

    if workout_usage:
        raise HTTPException(
            status_code=400,
            detail="Exercise is used in workouts"
        )

    db.query(PlanExercise).filter(
        PlanExercise.exercise_id == exercise_id
    ).delete(synchronize_session=False)

    db.delete(exercise)
    db.commit()

    return {"message": "deleted"}
