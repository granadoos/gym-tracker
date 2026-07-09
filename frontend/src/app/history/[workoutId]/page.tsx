"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import DurationInput from "@/components/DurationInput";
import { WorkoutFull, WorkoutSet, WorkoutStatus, api } from "@/lib/api";
import { formatDurationInput } from "@/lib/formatter";

function formatWorkoutDate(value: string) {
  const date = new Date(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);

  return `${day}/${month}/${year}`;
}

function getStatusBadge(status: WorkoutStatus) {
  if (status === "completed") {
    return {
      icon: "✓",
      label: "Completado",
      className: "status-badge status-badge-complete",
    };
  }

  return {
    icon: "●",
    label: "En curso",
    className: "status-badge status-badge-progress",
  };
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
  const [saving, setSaving] = useState(false);
  const [tipo, setTipo] = useState<string>("-");
  const [statusDraft, setStatusDraft] = useState<WorkoutStatus>("in_progress");

  useEffect(() => {
    if (workout) {
      setStatusDraft(workout.status);
    }
  }, [workout]);

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

  function updateWorkoutSet(setId: number, nextSet: WorkoutSet) {
    setWorkout((current) => {
      if (!current) return current;

      return {
        ...current,
        exercises: current.exercises.map((exercise) => ({
          ...exercise,
          sets: exercise.sets.map((set) => (set.id === setId ? nextSet : set)),
        })),
      };
    });
  }

  function patchWorkoutSetField(
    setId: number,
    field: "reps" | "weight" | "duration_seconds" | "completed",
    value: number | null | boolean
  ) {
    setWorkout((current) => {
      if (!current) return current;

      return {
        ...current,
        exercises: current.exercises.map((exercise) => ({
          ...exercise,
          sets: exercise.sets.map((set) =>
            set.id === setId ? ({ ...set, [field]: value } as WorkoutSet) : set
          ),
        })),
      };
    });
  }

  async function saveSetValue(
    setId: number,
    field: "reps" | "weight" | "duration_seconds" | "completed",
    value: number | null | boolean
  ) {
    setSaving(true);
    setError(null);

    try {
      const updated = await api.updateSet(setId, {
        [field]: value,
      });
      updateWorkoutSet(setId, updated);
    } catch {
      setError("No se pudo actualizar la serie.");
    } finally {
      setSaving(false);
    }
  }

  async function saveWorkoutStatus() {
    if (!workout) return;

    setSaving(true);
    setError(null);

    try {
      const updated = await api.updateWorkoutStatus(workout.id, statusDraft);
      setWorkout((current) =>
        current ? { ...current, status: updated.status } : current
      );
    } catch {
      setError("No se pudo actualizar el estado del workout.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="history-shell">
      <header className="mobile-header">
        <div>
          <p className="eyebrow">Gym Tracker</p>
          <h1>Detalle workout</h1>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={() => router.push("/history")}
          aria-label="Volver al historico"
          title="Volver"
        >
          ⬅
        </button>
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
              <div className="history-summary-main">
                <div className="history-summary-pill">
                  <span>Fecha</span>
                  <strong>{formatWorkoutDate(workout.date)}</strong>
                </div>
                <div className="history-summary-meta">
                  <span>Plan</span>
                  <strong>{tipo}</strong>
                </div>
                <div className={getStatusBadge(workout.status).className}>
                  <span>{getStatusBadge(workout.status).icon}</span>
                  <strong>{getStatusBadge(workout.status).label}</strong>
                </div>
              </div>
              <div className="history-status-editor">
                <label className="history-status-label" htmlFor="workout-status-select">
                  <span>Acciones</span>
                  <select
                    id="workout-status-select"
                    value={statusDraft}
                    onChange={(event) =>
                      setStatusDraft(event.target.value as WorkoutStatus)
                    }
                    disabled={saving}
                  >
                    <option value="in_progress">En curso</option>
                    <option value="completed">Completado</option>
                  </select>
                </label>
                <button
                  className="primary-action"
                  type="button"
                  onClick={() => void saveWorkoutStatus()}
                  disabled={saving || statusDraft === workout.status}
                >
                  {saving ? "Guardando..." : "Cambiar estado"}
                </button>
                <button
                  className="secondary-action"
                  type="button"
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
                  disabled={saving}
                >
                  Borrar
                </button>
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
                        <span>
                          <input
                            type="number"
                            value={set.reps ?? ""}
                            onChange={(event) => {
                              const nextValue =
                                event.target.value === ""
                                  ? null
                                  : Number(event.target.value);
                              patchWorkoutSetField(set.id, "reps", nextValue);
                            }}
                            onBlur={(event) => {
                              const nextValue =
                                event.target.value === ""
                                  ? null
                                  : Number(event.target.value);
                              void saveSetValue(set.id, "reps", nextValue);
                            }}
                            inputMode="numeric"
                            placeholder="-"
                          />
                        </span>
                        <span>
                          <input
                            type="number"
                            value={set.weight ?? ""}
                            onChange={(event) => {
                              const nextValue =
                                event.target.value === ""
                                  ? null
                                  : Number(event.target.value);
                              patchWorkoutSetField(set.id, "weight", nextValue);
                            }}
                            onBlur={(event) => {
                              const nextValue =
                                event.target.value === ""
                                  ? null
                                  : Number(event.target.value);
                              void saveSetValue(set.id, "weight", nextValue);
                            }}
                            inputMode="decimal"
                            placeholder="-"
                          />
                        </span>
                        <span>
                          <DurationInput
                            value={set.duration_seconds}
                            onChange={(nextValue) => {
                              patchWorkoutSetField(set.id, "duration_seconds", nextValue);
                            }}
                            onBlur={(nextValue) => {
                              void saveSetValue(set.id, "duration_seconds", nextValue);
                            }}
                          />
                        </span>
                        <span>
                          <input
                            type="checkbox"
                            checked={set.completed}
                            onChange={(event) => {
                              const nextValue = event.target.checked;
                              patchWorkoutSetField(set.id, "completed", nextValue);
                              void saveSetValue(set.id, "completed", nextValue);
                            }}
                          />
                        </span>
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
