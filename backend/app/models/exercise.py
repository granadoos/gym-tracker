from sqlalchemy import Column, Integer, String
from app.database.database import Base

class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, index=True)
    
    name = Column(String, index=True)
    
    muscle_group = Column(String)