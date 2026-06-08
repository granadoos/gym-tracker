from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class WorkoutExerciseCreate(BaseModel):
    exercise_id: int
    order_index: int
    default_sets: int
    reps: Optional[int] = None
    weight: Optional[float] = None
    duration_seconds: Optional[int] = None


class WorkoutSetFullResponse(BaseModel):
    id: int
    reps: Optional[int] = None
    weight: Optional[float] = None
    duration_seconds: Optional[int] = None
    completed: bool

    class Config:
        orm_mode = True


class WorkoutExerciseFullResponse(BaseModel):
    id: int
    exercise_id: int
    exercise_name: str
    order_index: int
    sets: list[WorkoutSetFullResponse]

    class Config:
        orm_mode = True


class WorkoutFullResponse(BaseModel):
    id: int
    status: str
    date: datetime
    exercises: list[WorkoutExerciseFullResponse]

    class Config:
        orm_mode = True


