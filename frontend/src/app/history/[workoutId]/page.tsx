"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { WorkoutFull, api } from "@/lib/api";
import { formatDurationInput } from "@/lib/formatter";

function formatWorkoutDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatSetValue(value: number | null, suffix = "") {
  if (value === null) return "-";

  return `${value}${suffix}`;
}

export default function HistoryDetailPage() {
  const params = useParams<{ workoutId: string }>();
  const workoutId = Number(params.workoutId);
  const [workout, setWorkout] = useState<WorkoutFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadWorkout() {
      try {
        setError(null);
        setLoading(true);
        const data = await api.getWorkoutFull(workoutId);

        if (!isActive) return;
        setWorkout(data);
      } catch {
        if (isActive) {
          setError("No se pudo cargar el detalle del workout.");
          setWorkout(null);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadWorkout();

    return () => {
      isActive = false;
    };
  }, [workoutId]);

  const workoutStats = useMemo(() => {
    if (!workout) {
      return {
        exercises: 0,
        sets: 0,
        completedSets: 0,
      };
    }

    const sets = workout.exercises.flatMap((exercise) => exercise.sets);

    return {
      exercises: workout.exercises.length,
      sets: sets.length,
      completedSets: sets.filter((set) => set.completed).length,
    };
  }, [workout]);

  return (
    <main className="history-shell">
      <header className="mobile-header">
        <div>
          <p className="eyebrow">Gym Tracker</p>
          <h1>Detalle workout</h1>
        </div>
        <Link className="header-link" href="/history">
          Volver
        </Link>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="history-detail">
        {loading ? (
          <div className="empty-state">Cargando detalle...</div>
        ) : !workout ? (
          <div className="empty-state">No se encontró el workout.</div>
        ) : (
          <>
            <div className="mobile-card workout-summary history-summary">
              <div>
                <span>{workout.status}</span>
                <strong>Workout #{workout.id}</strong>
              </div>
              <div>
                <span>Fecha</span>
                <strong>{formatWorkoutDate(workout.date)}</strong>
              </div>
            </div>

            <div className="history-stats">
              <div>
                <span>Ejercicios</span>
                <strong>{workoutStats.exercises}</strong>
              </div>
              <div>
                <span>Series</span>
                <strong>{workoutStats.sets}</strong>
              </div>
              <div>
                <span>Completadas</span>
                <strong>{workoutStats.completedSets}</strong>
              </div>
            </div>

            <section className="workout-stack">
              {workout.exercises.map((exercise) => (
                <div className="workout-exercise" key={exercise.id}>
                  <div className="workout-exercise-header">
                    <span>{exercise.order_index}</span>
                    <strong>{exercise.exercise_name}</strong>
                  </div>

                  <div className="set-table">
                    <div className="set-row history-set-row set-head">
                      <span>Set</span>
                      <span>Reps</span>
                      <span>Peso</span>
                      <span>Min:Seg</span>
                      <span>Done</span>
                    </div>

                    {exercise.sets.map((set, index) => (
                      <div className="set-row history-set-row" key={set.id}>
                        <span>{index + 1}</span>
                        <span>{formatSetValue(set.reps)}</span>
                        <span>{formatSetValue(set.weight, " kg")}</span>
                        <span>
                          {set.duration_seconds === null
                            ? "-"
                            : formatDurationInput(set.duration_seconds)}
                        </span>
                        <span>{set.completed ? "Si" : "No"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          </>
        )}
      </section>
    </main>
  );
}
