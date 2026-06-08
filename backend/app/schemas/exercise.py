from pydantic import BaseModel


class ExerciseCreate(BaseModel):
    name: str
    muscle_group: str