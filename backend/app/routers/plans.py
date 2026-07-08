from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.models.plan import TrainingPlan, PlanDay, PlanExercise
from app.models.exercise import Exercise
from app.schemas.plans import (
    PlanCreate,
    PlanDayCreate,
    PlanDayPlanUpdate,
    PlanDayWorkoutTypeUpdate,
    PlanExerciseBatchDefaultSetsUpdate,
    PlanExerciseCreate,
    PlanExerciseUpdate,
)

router = APIRouter(
    prefix="/plans",
    tags=["Plans"]
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/")
def create_plan(
    plan_data: PlanCreate,
    db: Session = Depends(get_db)
):
    plan = TrainingPlan(name=plan_data.name)

    db.add(plan)
    db.commit()
    db.refresh(plan)

    return plan


@router.get("/")
def get_plans(db: Session = Depends(get_db)):
    return db.query(TrainingPlan).all()


@router.get("/days")
def get_plan_day(db: Session = Depends(get_db)):
    existing_days = db.query(PlanDay).all()
    existing_week_days = {
        day.day_of_week
        for day in existing_days
        if day.day_of_week is not None
    }

    for day_of_week in range(7):
        if day_of_week not in existing_week_days:
            db.add(PlanDay(day_of_week=day_of_week))

    db.commit()

    return db.query(PlanDay).order_by(PlanDay.day_of_week).all()


@router.get("/{plan_id}")
def get_plan(
    plan_id: int,
    db: Session = Depends(get_db)
):
    return db.query(TrainingPlan).filter(
        TrainingPlan.id == plan_id
    ).first()


@router.delete("/{plan_id}")
def delete_plan(
    plan_id: int,
    db: Session = Depends(get_db)
):
    plan = db.query(TrainingPlan).filter(
        TrainingPlan.id == plan_id
    ).first()

    if not plan:
        raise HTTPException(
            status_code=404,
            detail="Plan not found"
        )

    db.query(PlanDay).filter(
        PlanDay.plan_id == plan_id
    ).update(
        {PlanDay.plan_id: None},
        synchronize_session=False
    )

    db.delete(plan)
    db.commit()

    return {"message": "plan deleted"}


@router.post("/{plan_id}/days")
def create_plan_day(
    plan_id: int,
    plan_day_create:  PlanDayCreate,
    db: Session = Depends(get_db)
):
    day = PlanDay(
        plan_id=plan_id,
        day_of_week=plan_day_create.day_of_week
    )

    db.add(day)
    db.commit()
    db.refresh(day)

    return day


@router.delete("/days/{plan_day_id}")
def delete_plan_day(
    plan_day_id: int,
    db: Session = Depends(get_db)
):
    plan_day = db.query(PlanDay).filter(
        PlanDay.id == plan_day_id
    ).first()

    if not plan_day:
        raise HTTPException(
            status_code=404,
            detail="Plan day not found"
        )

    db.delete(plan_day)
    db.commit()

    return {"message": "plan day deleted"}


@router.patch("/days/{plan_day_id}/plan")
def update_plan_day_plan(
    plan_day_id: int,
    plan_day_update: PlanDayPlanUpdate,
    db: Session = Depends(get_db)
):
    plan_day = db.query(PlanDay).filter(
        PlanDay.id == plan_day_id
    ).first()

    if not plan_day:
        raise HTTPException(
            status_code=404,
            detail="Plan day not found"
        )

    if plan_day_update.plan_id is not None:
        plan = db.query(TrainingPlan).filter(
            TrainingPlan.id == plan_day_update.plan_id
        ).first()

        if not plan:
            raise HTTPException(
                status_code=404,
                detail="Plan not found"
            )

    plan_day.plan_id = plan_day_update.plan_id

    db.commit()
    db.refresh(plan_day)

    return plan_day


@router.patch("/days/{plan_day_id}/workout-type")
def update_plan_day_workout_type(
    plan_day_id: int,
    workout_type_update: PlanDayWorkoutTypeUpdate,
    db: Session = Depends(get_db)
):
    plan_day = db.query(PlanDay).filter(
        PlanDay.id == plan_day_id
    ).first()

    if not plan_day:
        raise HTTPException(
            status_code=404,
            detail="Plan day not found"
        )

    if workout_type_update.workout_type not in ("normal", "circuit"):
        raise HTTPException(
            status_code=400,
            detail="workout_type must be normal or circuit"
        )

    plan_day.workout_type = workout_type_update.workout_type

    if workout_type_update.circuit_rest_seconds is not None:
        plan_day.circuit_rest_seconds = workout_type_update.circuit_rest_seconds

    if plan_day.circuit_rest_seconds is None:
        plan_day.circuit_rest_seconds = 90

    db.commit()
    db.refresh(plan_day)

    return plan_day




@router.post("/days/{plan_day_id}/exercises")
def add_exercise_to_day(
    plan_day_id: int,
    plan_exercise_create:  PlanExerciseCreate,
    db: Session = Depends(get_db)
):
    exercise = PlanExercise(
        plan_day_id=plan_day_id,
        exercise_id=plan_exercise_create.exercise_id,
        order_index=plan_exercise_create.order_index,
        default_sets=plan_exercise_create.default_sets,
        default_reps=plan_exercise_create.default_reps,
        default_weight=plan_exercise_create.default_weight,
        default_time_seconds=plan_exercise_create.default_time_seconds
    )

    db.add(exercise)
    db.commit()
    db.refresh(exercise)

    return exercise


@router.patch("/days/{plan_day_id}/exercises/bulk-default-sets")
def update_plan_day_exercises_default_sets(
    plan_day_id: int,
    plan_exercise_update: PlanExerciseBatchDefaultSetsUpdate,
    db: Session = Depends(get_db)
):
    plan_day = db.query(PlanDay).filter(
        PlanDay.id == plan_day_id
    ).first()

    if not plan_day:
        raise HTTPException(
            status_code=404,
            detail="Plan day not found"
        )

    plan_exercises = db.query(PlanExercise).filter(
        PlanExercise.plan_day_id == plan_day_id
    ).all()

    for plan_exercise in plan_exercises:
        plan_exercise.default_sets = plan_exercise_update.default_sets

    db.commit()

    return {"message": "plan exercises updated", "updated_count": len(plan_exercises)}


@router.get("/days/{plan_day_id}/exercises")
def get_plan_day_exercises(
    plan_day_id: int,
    db: Session = Depends(get_db)
):
    rows = db.query(
        PlanExercise,
        Exercise.name.label("exercise_name"),
        PlanDay.day_of_week.label("day_of_week"),
        TrainingPlan.name.label("training_plan_name")
    ).join(
        Exercise,
        PlanExercise.exercise_id == Exercise.id
    ).join(
        PlanDay,
        PlanExercise.plan_day_id == PlanDay.id
    ).join(
        TrainingPlan,
        PlanDay.plan_id == TrainingPlan.id
    ).filter(
        PlanExercise.plan_day_id == plan_day_id
    ).order_by(
        PlanExercise.order_index
    ).all()

    return [
        {
            "id": plan_exercise.id,
            "plan_day_id": plan_exercise.plan_day_id,
            "day_of_week": day_of_week,
            "training_plan_name": training_plan_name,
            "exercise_id": plan_exercise.exercise_id,
            "exercise_name": exercise_name,
            "order_index": plan_exercise.order_index,
            "default_sets": plan_exercise.default_sets,
            "default_reps": plan_exercise.default_reps,
            "default_weight": plan_exercise.default_weight,
            "default_time_seconds": plan_exercise.default_time_seconds,
        }
        for (
            plan_exercise,
            exercise_name,
            day_of_week,
            training_plan_name
        ) in rows
    ]


@router.delete("/days/{plan_day_id}/exercises/{plan_exercise_id}")
def delete_plan_exercise(
    plan_day_id: int,
    plan_exercise_id: int,
    db: Session = Depends(get_db)
):
    plan_exercise = db.query(PlanExercise).filter(
        PlanExercise.id == plan_exercise_id,
        PlanExercise.plan_day_id == plan_day_id
    ).first()

    if not plan_exercise:
        raise HTTPException(
            status_code=404,
            detail="Plan exercise not found"
        )

    db.delete(plan_exercise)
    db.commit()

    return {"message": "plan exercise deleted"}


@router.patch("/days/{plan_day_id}/exercises/{plan_exercise_id}")
def update_plan_exercise(
    plan_day_id: int,
    plan_exercise_id: int,
    plan_exercise_update: PlanExerciseUpdate,
    db: Session = Depends(get_db)
):
    plan_exercise = db.query(PlanExercise).filter(
        PlanExercise.id == plan_exercise_id,
        PlanExercise.plan_day_id == plan_day_id
    ).first()

    if not plan_exercise:
        raise HTTPException(
            status_code=404,
            detail="Plan exercise not found"
        )

    if plan_exercise_update.default_sets is not None:
        plan_exercise.default_sets = plan_exercise_update.default_sets
    
    if plan_exercise_update.default_reps is not None:
        plan_exercise.default_reps = plan_exercise_update.default_reps
    
    if plan_exercise_update.default_weight is not None:
        plan_exercise.default_weight = plan_exercise_update.default_weight
    
    if plan_exercise_update.default_time_seconds is not None:
        plan_exercise.default_time_seconds = plan_exercise_update.default_time_seconds

    db.commit()
    db.refresh(plan_exercise)

    return plan_exercise


@router.post("/days/{plan_day_id}/exercises/{plan_exercise_id}/touch")
def touch_plan_exercise(
    plan_day_id: int,
    plan_exercise_id: int,
    db: Session = Depends(get_db)
):
    plan_exercise = db.query(PlanExercise).filter(
        PlanExercise.id == plan_exercise_id,
        PlanExercise.plan_day_id == plan_day_id
    ).first()

    if not plan_exercise:
        raise HTTPException(
            status_code=404,
            detail="Plan exercise not found"
        )

    plan_exercise.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(plan_exercise)

    return plan_exercise
