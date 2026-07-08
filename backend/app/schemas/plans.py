from typing import Optional
from pydantic import BaseModel

class PlanCreate(BaseModel):
    name: str


class PlanDayCreate(BaseModel):
    day_of_week: int


class PlanDayPlanUpdate(BaseModel):
    plan_id: Optional[int] = None


class PlanDayWorkoutTypeUpdate(BaseModel):
    workout_type: str
    circuit_rest_seconds: Optional[int] = None


class PlanExerciseCreate(BaseModel):
    exercise_id: int
    order_index: int
    default_sets: int

    default_reps: Optional[int] = None
    default_weight: Optional[float] = None
    default_time_seconds: Optional[int] = None


class PlanExerciseUpdate(BaseModel):
    default_sets: Optional[int] = None
    default_reps: Optional[int] = None
    default_weight: Optional[float] = None
    default_time_seconds: Optional[int] = None


class PlanExerciseBatchDefaultSetsUpdate(BaseModel):
    default_sets: int
