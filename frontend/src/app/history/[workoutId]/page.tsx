"use client";

import { useParams, useRouter } from "next/navigation";
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
  const router = useRouter();
  const [workout, setWorkout] = useState<WorkoutFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<string>("-");

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

  useEffect(() => {
    let isActive = true;

    async function loadTipo() {
      try {
        const summary = await api.getWorkout(workoutId);
        if (!isActive) return;

        if (!summary.plan_day_id) {
          setTipo("-");
          return;
        }

        const [planDays, plans] = await Promise.all([
          api.getPlanDays(),
          api.getPlans(),
        ]);
        if (!isActive) return;

        const planDay = planDays.find((item) => item.id === summary.plan_day_id);
        const plan = planDay
          ? plans.find((item) => item.id === planDay.plan_id)
          : null;

        setTipo(plan?.name ?? "-");
      } catch {
        if (isActive) {
          setTipo("-");
        }
      }
    }

    void loadTipo();

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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            className="icon-button"
            type="button"
            onClick={() => router.push("/history")}
            aria-label="Volver al historico"
            title="Volver"
          >
            ⬅
          </button>
          <button
            className="icon-button danger"
            onClick={async () => {
              const ok = confirm(`Borrar workout #${workoutId}?`);
              if (!ok) return;

              try {
                setError(null);
                await api.deleteWorkout(workoutId);
                router.push("/history");
              } catch {
                setError("No se pudo borrar el workout.");
              }
            }}
            type="button"
            aria-label={`Borrar workout ${workoutId}`}
            title="Borrar"
          >
            x
          </button>
        </div>
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
              <div>
                <span>Planes</span>
                <strong>{tipo}</strong>
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
