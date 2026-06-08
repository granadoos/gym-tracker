"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { WorkoutFull, WorkoutSet, api } from "@/lib/api";
import DurationInput from "@/components/DurationInput";

type SetTimer = {
  phase: "idle" | "prep" | "work" | "done";
  isRunning: boolean;
  remainingSeconds: number;
};

function formatTimer(seconds: number) {
  const safeSeconds = Math.max(seconds, 0);
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;

  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function ringBell() {
  const audioWindow = window as Window & {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextClass = audioWindow.AudioContext || audioWindow.webkitAudioContext;

  if (!AudioContextClass) return;

  const audioContext = new AudioContextClass();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
  oscillator.frequency.setValueAtTime(660, audioContext.currentTime + 0.16);
  gain.gain.setValueAtTime(0.001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.35, audioContext.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.7);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.75);
}

export default function WorkoutPage() {
  const params = useParams<{ workoutId: string }>();
  const workoutId = Number(params.workoutId);
  const [workout, setWorkout] = useState<WorkoutFull | null>(null);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [timers, setTimers] = useState<Record<number, SetTimer>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerIntervals = useRef<Record<number, number>>({});

  const activeExercise = workout?.exercises[activeExerciseIndex] ?? null;
  const isFirstExercise = activeExerciseIndex === 0;
  const isLastExercise = workout
    ? activeExerciseIndex === workout.exercises.length - 1
    : false;
  const activeExerciseCompleted = activeExercise
    ? activeExercise.sets.length > 0 &&
      activeExercise.sets.every((set) => set.completed)
    : false;

  useEffect(() => {
    let isActive = true;

    async function loadWorkout() {
      try {
        setError(null);
        const data = await api.getWorkoutFull(workoutId);

        if (isActive) {
          setWorkout(data);
          setActiveExerciseIndex(0);
        }
      } catch {
        if (isActive) {
          setError("No se pudo cargar el workout.");
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    if (Number.isFinite(workoutId)) {
      void loadWorkout();
    }

    return () => {
      isActive = false;
    };
  }, [workoutId]);

  useEffect(() => {
    const intervals = timerIntervals.current;

    return () => {
      Object.values(intervals).forEach((intervalId) => {
        window.clearInterval(intervalId);
      });
    };
  }, []);

  function updateSet(setId: number, nextSet: WorkoutSet) {
    setWorkout((current) => {
      if (!current) return current;

      return {
        ...current,
        exercises: current.exercises.map((exercise) => ({
          ...exercise,
          sets: exercise.sets.map((set) =>
            set.id === setId ? nextSet : set
          ),
        })),
      };
    });
  }

  function updateSetDraft(
    setId: number,
    field: "reps" | "weight" | "duration_seconds",
    value: number | null
  ) {
    setWorkout((current) => {
      if (!current) return current;

      return {
        ...current,
        exercises: current.exercises.map((exercise) => ({
          ...exercise,
          sets: exercise.sets.map((set) =>
            set.id === setId ? { ...set, [field]: value } : set
          ),
        })),
      };
    });
  }

  async function saveSet(
    set: WorkoutSet,
    field: "reps" | "weight" | "duration_seconds"
  ) {
    setSaving(true);
    setError(null);

    try {
      const updated = await api.updateSet(set.id, {
        [field]: set[field],
      });
      updateSet(set.id, updated);
    } catch {
      setError("No se pudo actualizar la serie.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleSet(set: WorkoutSet) {
    setSaving(true);
    setError(null);

    try {
      const updated = await api.updateSet(set.id, {
        completed: !set.completed,
      });
      updateSet(set.id, updated);
    } catch {
      setError("No se pudo marcar la serie.");
    } finally {
      setSaving(false);
    }
  }

  async function completeSet(set: WorkoutSet) {
    if (set.completed) return;

    try {
      const updated = await api.updateSet(set.id, {
        completed: true,
      });
      updateSet(set.id, updated);
    } catch {
      setError("No se pudo marcar la serie.");
    }
  }

  function runTimerInterval(
    set: WorkoutSet,
    totalSeconds: number,
    initialPhase: SetTimer["phase"],
    initialRemainingSeconds: number
  ) {
    let phase = initialPhase;
    let remainingSeconds = initialRemainingSeconds;

    window.clearInterval(timerIntervals.current[set.id]);
    timerIntervals.current[set.id] = window.setInterval(() => {
      remainingSeconds -= 1;

      if (phase === "prep" && remainingSeconds <= 0) {
        phase = "work";
        remainingSeconds = totalSeconds;
        setTimers((current) => ({
          ...current,
          [set.id]: {
            phase,
            isRunning: true,
            remainingSeconds,
          },
        }));
        return;
      }

      if (phase === "work" && remainingSeconds <= 0) {
        window.clearInterval(timerIntervals.current[set.id]);
        delete timerIntervals.current[set.id];
        setTimers((current) => ({
          ...current,
          [set.id]: {
            phase: "done",
            isRunning: false,
            remainingSeconds: 0,
          },
        }));
        ringBell();
        void completeSet(set);
        return;
      }

      setTimers((current) => ({
        ...current,
        [set.id]: {
          phase,
          isRunning: true,
          remainingSeconds,
        },
      }));
    }, 1000);
  }

  function startTimer(set: WorkoutSet) {
    if (!set.duration_seconds || set.duration_seconds <= 0) return;

    const totalSeconds = set.duration_seconds;
    const currentTimer = timers[set.id];
    const nextPhase =
      currentTimer?.phase === "prep" || currentTimer?.phase === "work"
        ? currentTimer.phase
        : "prep";
    const nextRemainingSeconds =
      currentTimer?.phase === "prep" || currentTimer?.phase === "work"
        ? currentTimer.remainingSeconds
        : 5;

    setTimers((current) => ({
      ...current,
      [set.id]: {
        phase: nextPhase,
        isRunning: true,
        remainingSeconds: nextRemainingSeconds,
      },
    }));

    runTimerInterval(set, totalSeconds, nextPhase, nextRemainingSeconds);
  }

  function pauseTimer(setId: number) {
    window.clearInterval(timerIntervals.current[setId]);
    delete timerIntervals.current[setId];

    setTimers((current) => {
      const currentTimer = current[setId];
      if (!currentTimer) return current;

      return {
        ...current,
        [setId]: {
          ...currentTimer,
          isRunning: false,
        },
      };
    });
  }

  function finishTimer(set: WorkoutSet) {
    window.clearInterval(timerIntervals.current[set.id]);
    delete timerIntervals.current[set.id];

    setTimers((current) => ({
      ...current,
      [set.id]: {
        phase: "done",
        isRunning: false,
        remainingSeconds: 0,
      },
    }));

    void completeSet(set);
  }

  async function finishWorkout() {
    if (!workout) return;

    setSaving(true);
    setError(null);

    try {
      await api.finishWorkout(workout.id);
      setWorkout({ ...workout, status: "completed" });
      setShowFinishModal(true);
    } catch {
      setError("No se pudo finalizar el workout.");
    } finally {
      setSaving(false);
    }
  }

  function goToPreviousExercise() {
    setActiveExerciseIndex((current) => Math.max(current - 1, 0));
  }

  function goToNextExercise() {
    if (!workout || !activeExerciseCompleted) return;

    setActiveExerciseIndex((current) =>
      Math.min(current + 1, workout.exercises.length - 1)
    );
  }

  function selectExercise(index: number) {
    if (index <= activeExerciseIndex || activeExerciseCompleted) {
      setActiveExerciseIndex(index);
    }
  }

  return (
    <main className="mobile-shell">
      <header className="mobile-header">
        <div>
          <p className="eyebrow">Workout</p>
          <h1>{workout ? `#${workout.id}` : "Cargando"}</h1>
        </div>
        <Link className="header-link" href="/">
          Inicio
        </Link>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      {loading ? (
        <section className="empty-state">Cargando workout...</section>
      ) : !workout ? (
        <section className="empty-state">Workout no encontrado.</section>
      ) : workout.exercises.length === 0 ? (
        <section className="empty-state">Este workout no tiene ejercicios.</section>
      ) : (
        <>
          <section className="mobile-card workout-summary">
            <span>{workout.status}</span>
            <strong>{new Date(workout.date).toLocaleString()}</strong>
          </section>

          <section className="mobile-card workout-step-progress">
            <span>
              Ejercicio {activeExerciseIndex + 1} de {workout.exercises.length}
            </span>
            <div>
              {workout.exercises.map((exercise, index) => (
                <button
                  aria-label={`Ir al ejercicio ${index + 1}`}
                  className={index === activeExerciseIndex ? "active" : ""}
                  disabled={index > activeExerciseIndex && !activeExerciseCompleted}
                  key={exercise.id}
                  onClick={() => selectExercise(index)}
                  type="button"
                />
              ))}
            </div>
          </section>

          {activeExercise ? (
            <section className="workout-step-card">
              <div className="workout-exercise">
                <div className="workout-exercise-header">
                  <span>{activeExercise.order_index}</span>
                  <strong>{activeExercise.exercise_name}</strong>
                </div>

                <div className="set-table">
                  <div className="set-row set-head">
                    <span>Set</span>
                    <span>Reps</span>
                    <span>Peso</span>
                    <span>Min:Seg</span>
                    <span>Done</span>
                  </div>

                  {activeExercise.sets.map((set, index) => {
                    const timer = timers[set.id] ?? {
                      phase: "idle",
                      isRunning: false,
                      remainingSeconds: set.duration_seconds ?? 0,
                    };
                    const hasTimer =
                      set.duration_seconds !== null && set.duration_seconds > 0;
                    const isTimerActive =
                      (timer.phase === "prep" || timer.phase === "work") &&
                      timer.isRunning;

                    return (
                    <div
                      className={`set-row timer-${timer.phase}`}
                      key={set.id}
                    >
                      <span>{index + 1}</span>
                      <input
                        min={0}
                        type="number"
                        value={set.reps ?? ""}
                        onBlur={() => saveSet(set, "reps")}
                        onChange={(event) =>
                          updateSetDraft(
                            set.id,
                            "reps",
                            event.target.value === ""
                              ? null
                              : Number(event.target.value)
                          )
                        }
                      />
                      <input
                        min={0}
                        step="0.5"
                        type="number"
                        value={set.weight ?? ""}
                        onBlur={() => saveSet(set, "weight")}
                        onChange={(event) =>
                          updateSetDraft(
                            set.id,
                            "weight",
                            event.target.value === ""
                              ? null
                              : Number(event.target.value)
                          )
                        }
                      />
                      <div className="duration-timer-cell">
                        <DurationInput
                          value={set.duration_seconds}
                          onBlur={() => saveSet(set, "duration_seconds")}
                          onChange={(value) =>
                            updateSetDraft(
                              set.id,
                              "duration_seconds",
                              value
                            )
                          }
                        />
                        {hasTimer ? (
                          <div className="set-timer">
                            <div className="timer-controls">
                              <button
                                aria-label="Iniciar temporizador"
                                disabled={
                                  workout.status === "completed" ||
                                  saving ||
                                  isTimerActive ||
                                  timer.phase === "done"
                                }
                                onClick={() => startTimer(set)}
                                title="Iniciar"
                                type="button"
                              >
                                ▶
                              </button>
                              <button
                                aria-label="Pausar temporizador"
                                disabled={
                                  workout.status === "completed" ||
                                  saving ||
                                  !isTimerActive
                                }
                                onClick={() => pauseTimer(set.id)}
                                title="Pausar"
                                type="button"
                              >
                                ||
                              </button>
                              <button
                                aria-label="Terminar temporizador"
                                disabled={
                                  workout.status === "completed" ||
                                  saving ||
                                  timer.phase === "done"
                                }
                                onClick={() => finishTimer(set)}
                                title="Terminar"
                                type="button"
                              >
                                ✓
                              </button>
                            </div>
                            <span>
                              {timer.phase === "prep"
                                ? `Prep ${timer.remainingSeconds}s`
                                : timer.phase === "done"
                                ? "Completado"
                                : formatTimer(timer.remainingSeconds)}
                            </span>
                          </div>
                        ) : null}
                      </div>
                      <input
                        checked={set.completed}
                        className="set-checkbox"
                        disabled={workout.status === "completed" || saving}
                        onChange={() => toggleSet(set)}
                        type="checkbox"
                      />
                    </div>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : null}

          {!activeExerciseCompleted ? (
            <p className="workout-step-hint">
              Completa todos los Done para continuar.
            </p>
          ) : null}

          <section className="workout-step-actions">
            <button
              className="secondary-action"
              disabled={isFirstExercise || saving}
              onClick={goToPreviousExercise}
              type="button"
            >
              Anterior
            </button>

            {isLastExercise ? (
              <button
                className="primary-action"
                disabled={
                  workout.status === "completed" ||
                  saving ||
                  !activeExerciseCompleted
                }
                onClick={finishWorkout}
                type="button"
              >
                Finalizar sesion
              </button>
            ) : (
              <button
                className="primary-action"
                disabled={saving || !activeExerciseCompleted}
                onClick={goToNextExercise}
                type="button"
              >
                Siguiente ejercicio
              </button>
            )}
          </section>

          {showFinishModal ? (
            <div className="finish-modal-backdrop" role="presentation">
              <section
                aria-labelledby="finish-modal-title"
                className="finish-modal"
                role="dialog"
              >
                <p className="eyebrow">Workout completado</p>
                <h2 id="finish-modal-title">Buen trabajo</h2>
                <p>
                  Has terminado la sesion. Tus series quedan guardadas en el
                  historico.
                </p>
                <Link className="primary-action" href="/">
                  Volver al inicio
                </Link>
              </section>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
