from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database.database import Base


class Workout(Base):
    __tablename__ = "workouts"

    id = Column(Integer, primary_key=True, index=True)

    plan_day_id = Column(Integer, ForeignKey("plan_days.id"), nullable=True)

    date = Column(DateTime, default=datetime.utcnow)

    status = Column(String, default="in_progress")  # in_progress | completed

    exercises = relationship("WorkoutExercise", back_populates="workout", cascade="all, delete-orphan")


class WorkoutExercise(Base):
    __tablename__ = "workout_exercises"

    id = Column(Integer, primary_key=True, index=True)

    workout_id = Column(Integer, ForeignKey("workouts.id"))
    
    exercise_id = Column(Integer, ForeignKey("exercises.id"))

    order_index = Column(Integer)

    workout = relationship("Workout", back_populates="exercises")

    exercise = relationship("Exercise")
    
    sets = relationship("Set", back_populates="workout_exercise", cascade="all, delete-orphan")