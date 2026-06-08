from sqlalchemy import Column, Integer, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database.database import Base


class Set(Base):
    __tablename__ = "sets"

    id = Column(Integer, primary_key=True, index=True)
    
    workout_exercise_id = Column(Integer, ForeignKey("workout_exercises.id"))
    
    reps = Column(Integer, nullable=True)
    
    weight = Column(Float, nullable=True)
    
    duration_seconds = Column(Integer, nullable=True)
    
    completed = Column(Boolean, default=False)

    workout_exercise = relationship("WorkoutExercise", back_populates="sets")