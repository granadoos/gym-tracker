from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.models.walking import WalkingEntry, WalkingSettings

router = APIRouter(prefix="/walking", tags=["Walking"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class WalkingEntryCreate(BaseModel):
    kilometers: float = Field(gt=0, le=100)
    day: date


class WalkingGoalUpdate(BaseModel):
    daily_goal_kilometers: float = Field(gt=0, le=1000)


def get_settings(db: Session) -> WalkingSettings:
    settings = db.query(WalkingSettings).filter(WalkingSettings.id == 1).first()
    if settings is None:
        settings = WalkingSettings(id=1, daily_goal_kilometers=6.0)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("/today")
def get_today(day: date = Query(default_factory=date.today), db: Session = Depends(get_db)):
    entries = db.query(WalkingEntry).filter(WalkingEntry.day == day).order_by(WalkingEntry.id.desc()).all()
    total = db.query(func.coalesce(func.sum(WalkingEntry.kilometers), 0.0)).filter(WalkingEntry.day == day).scalar()
    settings = get_settings(db)
    return {
        "day": day.isoformat(),
        "kilometers": round(float(total), 2),
        "daily_goal_kilometers": settings.daily_goal_kilometers,
        "entries": [{"id": entry.id, "kilometers": entry.kilometers} for entry in entries],
    }


@router.post("/entries")
def add_entry(payload: WalkingEntryCreate, db: Session = Depends(get_db)):
    entry = WalkingEntry(day=payload.day, kilometers=payload.kilometers)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"id": entry.id, "kilometers": entry.kilometers}


@router.delete("/entries/{entry_id}")
def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(WalkingEntry).filter(WalkingEntry.id == entry_id).first()
    if entry is None:
        raise HTTPException(status_code=404, detail="Walking entry not found")
    db.delete(entry)
    db.commit()
    return {"message": "Walking entry deleted"}


@router.patch("/goal")
def update_goal(payload: WalkingGoalUpdate, db: Session = Depends(get_db)):
    settings = get_settings(db)
    settings.daily_goal_kilometers = payload.daily_goal_kilometers
    db.commit()
    db.refresh(settings)
    return {"daily_goal_kilometers": settings.daily_goal_kilometers}
