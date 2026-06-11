from sqlalchemy import Column, Float, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database.database import Base


class TrainingPlan(Base):
    __tablename__ = "training_plans"

    id = Column(Integer, primary_key=True, index=True)
    
    name = Column(String)

    days = relationship("PlanDay", back_populates="plan")


class PlanDay(Base):
    __tablename__ = "plan_days"

    id = Column(Integer, primary_key=True, index=True)

    plan_id = Column(Integer, ForeignKey("training_plans.id"), nullable=True)
    
    day_of_week = Column(Integer)  # 0-6

    plan = relationship("TrainingPlan", back_populates="days")
    
    exercises = relationship("PlanExercise", back_populates="day", cascade="all, delete-orphan")


class PlanExercise(Base):
    __tablename__ = "plan_exercises"

    id = Column(Integer, primary_key=True, index=True)

    plan_day_id = Column(Integer, ForeignKey("plan_days.id"))
    
    exercise_id = Column(Integer, ForeignKey("exercises.id"))

    order_index = Column(Integer)

    default_sets = Column(Integer, default=3)
    
    default_reps = Column(Integer, default=10)

    default_weight = Column(Float, nullable=True)
    
    default_time_seconds = Column(Integer, nullable=True)

    day = relationship("PlanDay", back_populates="exercises")
