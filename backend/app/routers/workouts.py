from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException

from app.database.database import SessionLocal

from app.models.plan import PlanDay, PlanExercise
from app.models.workout import Workout, WorkoutExercise
from app.models.set import Set

from app.schemas.workouts import WorkoutExerciseCreate, WorkoutFullResponse


router = APIRouter(
    prefix="/workouts",
    tags=["Workouts"]
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_latest_sets_by_exercise(
    db: Session,
    exercise_ids: list[int],
    exclude_workout_id: int | None = None,
):
    if not exercise_ids:
        return {}
    # Build base query for ranking workout_exercises per exercise
    base_q = db.query(
        WorkoutExercise.id.label("workout_exercise_id"),
        WorkoutExercise.exercise_id.label("exercise_id"),
        Workout.date.label("workout_date"),
        func.row_number().over(
            partition_by=WorkoutExercise.exercise_id,
            order_by=(
                Workout.date.desc(),
                Workout.id.desc(),
                WorkoutExercise.id.desc()
            )
        ).label("row_number")
    ).join(
        Workout,
        Workout.id == WorkoutExercise.workout_id
    ).filter(
        WorkoutExercise.exercise_id.in_(exercise_ids)
    )

    if exclude_workout_id is not None:
        base_q = base_q.filter(Workout.id != exclude_workout_id)

    ranked_workout_exercises = base_q.subquery()

    latest_workout_exercises = db.query(WorkoutExercise).options(
        joinedload(WorkoutExercise.sets)
    ).join(
        ranked_workout_exercises,
        WorkoutExercise.id == ranked_workout_exercises.c.workout_exercise_id
    ).filter(
        ranked_workout_exercises.c.row_number == 1
    ).all()

    return {
        workout_exercise.exercise_id: {
            "sets": sorted(
                workout_exercise.sets,
                key=lambda current_set: current_set.id
            ),
            "workout_date": db.query(ranked_workout_exercises.c.workout_date).filter(
                ranked_workout_exercises.c.workout_exercise_id == workout_exercise.id
            ).first()[0] if workout_exercise.id else None
        }
        for workout_exercise in latest_workout_exercises
    }


@router.post("/start/{plan_day_id}")
def start_workout(
    plan_day_id: int,
    db: Session = Depends(get_db)
):
    # Buscar el día del plan
    plan_day = db.query(PlanDay).filter(
        PlanDay.id == plan_day_id
    ).first()

    if not plan_day:
        raise HTTPException(
            status_code=404,
            detail="Plan day not found"
        )

    # Crear workout
    workout = Workout(
        plan_day_id=plan_day.id,
        status="in_progress"
    )

    db.add(workout)
    db.commit()
    db.refresh(workout)

    # Obtener ejercicios del plan
    plan_exercises = db.query(PlanExercise).filter(
        PlanExercise.plan_day_id == plan_day.id
    ).order_by(PlanExercise.order_index).all()

    latest_exercises_data = get_latest_sets_by_exercise(
        db=db,
        exercise_ids=[
            plan_exercise.exercise_id
            for plan_exercise in plan_exercises
        ],
        exclude_workout_id=workout.id
    )

    for plan_exercise in plan_exercises:

        # Crear workout exercise
        workout_exercise = WorkoutExercise(
            workout_id=workout.id,
            exercise_id=plan_exercise.exercise_id,
            order_index=plan_exercise.order_index
        )

        db.add(workout_exercise)
        db.commit()
        db.refresh(workout_exercise)

        # Obtener datos del último historial
        exercise_history = latest_exercises_data.get(
            plan_exercise.exercise_id,
            {"sets": [], "workout_date": None}
        )
        latest_sets = exercise_history["sets"]
        latest_workout_date = exercise_history["workout_date"]

        # Comparar recencia: si plan_exercise fue actualizado después del último workout, usar plan defaults
        use_plan_defaults = (
            plan_exercise.updated_at and 
            latest_workout_date and 
            plan_exercise.updated_at > latest_workout_date
        )

        # Crear sets usando lógica de recencia
        for set_index in range(plan_exercise.default_sets):
            latest_set = (
                latest_sets[set_index]
                if set_index < len(latest_sets)
                else None
            )

            # Determinar valores a usar basado en recencia
            if use_plan_defaults:
                # Plan exercise es más reciente, usar plan defaults
                reps = plan_exercise.default_reps
                duration_seconds = plan_exercise.default_time_seconds
                weight = plan_exercise.default_weight
            else:
                # Usar workout history si existe, sino plan defaults
                reps = (
                    latest_set.reps
                    if latest_set and latest_set.reps is not None
                    else plan_exercise.default_reps
                )
                duration_seconds = (
                    latest_set.duration_seconds
                    if latest_set and latest_set.duration_seconds is not None
                    else plan_exercise.default_time_seconds
                )
                weight = (
                    latest_set.weight
                    if latest_set and latest_set.weight is not None
                    else plan_exercise.default_weight
                )

            new_set = Set(
                workout_exercise_id=workout_exercise.id,
                reps=reps,
                duration_seconds=duration_seconds,
                weight=weight,
                completed=False
            )

            db.add(new_set)

    db.commit()

    return {
        "message": "Workout started",
        "workout_id": workout.id
    }



@router.post("/{workout_id}/exercise")
def add_exercise_to_workout(
    workout_id: int,
    workout_exercise_data: WorkoutExerciseCreate,
    db: Session = Depends(get_db)
):
    
    # Crear workout exercise
    workout_exercise = WorkoutExercise(
        workout_id=workout_id,
        exercise_id=workout_exercise_data.exercise_id,
        order_index=workout_exercise_data.order_index
    )

    db.add(workout_exercise)
    db.commit()
    db.refresh(workout_exercise)

    # Crear sets vacíos
    for _ in range(workout_exercise_data.default_sets):

        new_set = Set(
            workout_exercise_id=workout_exercise.id,
            reps=workout_exercise_data.reps,
            weight=workout_exercise_data.weight,
            duration_seconds = workout_exercise_data.duration_seconds,
            completed=False
        )

        db.add(new_set)
    
    db.commit()
    db.refresh(new_set)


    return workout_exercise


@router.get("/")
def get_workouts(
    db: Session = Depends(get_db)
):
    workouts = db.query(Workout).order_by(
        Workout.date.desc(),
        Workout.id.desc()
    ).all()

    return workouts



@router.get("/{workout_id}")
def get_workout(
    workout_id: int,
    db: Session = Depends(get_db)
):
    return db.query(Workout).filter(
        Workout.id == workout_id
    ).first()


@router.post("/{workout_id}/finish")
def finish_workout(
    workout_id: int,
    db: Session = Depends(get_db)
):
    workout = db.query(Workout).filter(
        Workout.id == workout_id
    ).first()

    workout.status = "completed"

    db.commit()

    return {
        "message": "workout completed"
    }


@router.get("/{workout_id}/full", response_model=WorkoutFullResponse)
def get_workout_full(
    workout_id: int,
    db: Session = Depends(get_db)
):
    workout = db.query(Workout).options(
        joinedload(Workout.exercises).joinedload(WorkoutExercise.exercise),
        joinedload(Workout.exercises).joinedload(WorkoutExercise.sets),
    ).filter(
        Workout.id == workout_id
    ).first()

    if not workout:
        raise HTTPException(
            status_code=404,
            detail="Workout not found"
        )

    workout.exercises.sort(key=lambda workout_exercise: workout_exercise.order_index or 0)

    for workout_exercise in workout.exercises:
        workout_exercise.sets.sort(key=lambda set_item: set_item.id)

    return {
        "id": workout.id,
        "status": workout.status,
        "date": workout.date,
        "exercises": [
            {
                "id": workout_exercise.id,
                "exercise_id": workout_exercise.exercise_id,
                "exercise_name": workout_exercise.exercise.name,
                "order_index": workout_exercise.order_index,
                "sets": workout_exercise.sets,
            }
            for workout_exercise in workout.exercises
        ]
    }

