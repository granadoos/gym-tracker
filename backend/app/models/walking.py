from sqlalchemy import Column, Date, Float, Integer
from app.database.database import Base


class WalkingEntry(Base):
    __tablename__ = "walking_entries"

    id = Column(Integer, primary_key=True, index=True)
    day = Column(Date, nullable=False, index=True)
    kilometers = Column(Float, nullable=False)


class WalkingSettings(Base):
    __tablename__ = "walking_settings"

    id = Column(Integer, primary_key=True)
    daily_goal_kilometers = Column(Float, nullable=False, default=6.0)
