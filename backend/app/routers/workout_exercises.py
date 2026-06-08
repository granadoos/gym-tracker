from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.models.workout import WorkoutExercise, Workout
from app.models.exercise import Exercise

router = APIRouter(
    prefix="/api/workout-exercises",
    tags=["Workout Exercises"]
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# CREATE
@router.post("/")
def create_workout_exercise(
    workout_id: int,
    exercise_id: int,
    order_index: int,
    db: Session = Depends(get_db)
):
    workout = db.query(Workout).filter(
        Workout.id == workout_id
    ).first()

    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    exercise = db.query(Exercise).filter(
        Exercise.id == exercise_id
    ).first()

    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    workout_exercise = WorkoutExercise(
        workout_id=workout_id,
        exercise_id=exercise_id,
        order_index=order_index
    )

    db.add(workout_exercise)
    db.commit()
    db.refresh(workout_exercise)

    return workout_exercise


# GET BY WORKOUT
@router.get("/workout/{workout_id}")
def get_workout_exercises(
    workout_id: int,
    db: Session = Depends(get_db)
):
    return db.query(WorkoutExercise).filter(
        WorkoutExercise.workout_id == workout_id
    ).order_by(WorkoutExercise.order_index).all()


# DELETE
@router.delete("/{workout_exercise_id}")
def delete_workout_exercise(
    workout_exercise_id: int,
    db: Session = Depends(get_db)
):
    workout_exercise = db.query(WorkoutExercise).filter(
        WorkoutExercise.id == workout_exercise_id
    ).first()

    if not workout_exercise:
        raise HTTPException(
            status_code=404,
            detail="WorkoutExercise not found"
        )

    db.delete(workout_exercise)
    db.commit()

    return {"message": "Deleted"}