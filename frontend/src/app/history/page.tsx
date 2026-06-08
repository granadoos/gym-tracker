"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { WorkoutFull, WorkoutSummary, api } from "@/lib/api";
import { formatDurationInput } from "@/lib/formatter";

function formatWorkoutDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatSetValue(value: number | null, suffix = "") {
  if (value === null) return "-";

  return `${value}${suffix}`;
}

export default function HistoryPage() {
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<number | null>(
    null
  );
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutFull | null>(
    null
  );
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSummary = workouts.find(
    (workout) => workout.id === selectedWorkoutId
  );

  const workoutStats = useMemo(() => {
    if (!selectedWorkout) {
      return {
        exercises: 0,
        sets: 0,
        completedSets: 0,
      };
    }

    const sets = selectedWorkout.exercises.flatMap(
      (exercise) => exercise.sets
    );

    return {
      exercises: selectedWorkout.exercises.length,
      sets: sets.length,
      completedSets: sets.filter((set) => set.completed).length,
    };
  }, [selectedWorkout]);

  useEffect(() => {
    let isActive = true;

    async function loadWorkouts() {
      try {
        setError(null);
        const data = await api.getWorkouts();

        if (!isActive) return;

        setWorkouts(data);
        setSelectedWorkoutId(data[0]?.id ?? null);
      } catch {
        if (isActive) {
          setError("No se pudo cargar el historico.");
        }
      } finally {
        if (isActive) {
          setLoadingList(false);
        }
      }
    }

    void loadWorkouts();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadWorkoutDetail() {
      if (!selectedWorkoutId) {
        setSelectedWorkout(null);
        return;
      }

      try {
        setError(null);
        setLoadingDetail(true);
        const data = await api.getWorkoutFull(selectedWorkoutId);

        if (isActive) {
          setSelectedWorkout(data);
        }
      } catch {
        if (isActive) {
          setSelectedWorkout(null);
          setError("No se pudo cargar el detalle del workout.");
        }
      } finally {
        if (isActive) {
          setLoadingDetail(false);
        }
      }
    }

    void loadWorkoutDetail();

    return () => {
      isActive = false;
    };
  }, [selectedWorkoutId]);

  return (
    <main className="history-shell">
      <header className="mobile-header">
        <div>
          <p className="eyebrow">Gym Tracker</p>
          <h1>Historico</h1>
        </div>
        <Link className="header-link" href="/">
          Inicio
        </Link>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="history-layout">
        <aside className="mobile-card history-list-panel">
          <div className="panel-header">
            <div>
              <h2>Workouts</h2>
              <p>
                {loadingList
                  ? "Cargando workouts"
                  : `${workouts.length} realizados`}
              </p>
            </div>
          </div>

          <div className="history-list">
            {workouts.map((workout) => (
              <button
                className={`history-item ${
                  workout.id === selectedWorkoutId ? "selected" : ""
                }`}
                key={workout.id}
                onClick={() => setSelectedWorkoutId(workout.id)}
                type="button"
              >
                <span>Workout #{workout.id}</span>
                <small>{formatWorkoutDate(workout.date)}</small>
                <strong>{workout.status}</strong>
              </button>
            ))}
          </div>

          {!loadingList && workouts.length === 0 ? (
            <div className="empty-state">Aun no hay workouts realizados.</div>
          ) : null}
        </aside>

        <section className="history-detail">
          {loadingDetail ? (
            <div className="empty-state">Cargando detalle...</div>
          ) : !selectedWorkout ? (
            <div className="empty-state">Selecciona un workout.</div>
          ) : (
            <>
              <div className="mobile-card workout-summary history-summary">
                <div>
                  <span>{selectedWorkout.status}</span>
                  <strong>Workout #{selectedWorkout.id}</strong>
                </div>
                <div>
                  <span>Fecha</span>
                  <strong>
                    {formatWorkoutDate(selectedSummary?.date ?? selectedWorkout.date)}
                  </strong>
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
                {selectedWorkout.exercises.map((exercise) => (
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
                        <div
                          className="set-row history-set-row"
                          key={set.id}
                        >
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
      </section>
    </main>
  );
}
