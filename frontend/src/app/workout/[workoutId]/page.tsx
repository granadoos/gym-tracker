"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import DurationInput from "@/components/DurationInput";
import {
  WorkoutExerciseFull,
  WorkoutFull,
  WorkoutSet,
  api,
} from "@/lib/api";

type SetTimer = {
  phase: "idle" | "prep" | "work" | "done";
  isRunning: boolean;
  remainingSeconds: number;
};

type WorkoutStep = {
  exercise: WorkoutExerciseFull;
  exerciseIndex: number;
  set: WorkoutSet;
  setIndex: number;
};

type WorkoutStepGroup = {
  exercise: WorkoutExerciseFull;
  exerciseIndex: number;
  steps: Array<WorkoutStep & { globalIndex: number }>;
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
  const AudioContextClass =
    audioWindow.AudioContext || audioWindow.webkitAudioContext;

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
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [timers, setTimers] = useState<Record<number, SetTimer>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerIntervals = useRef<Record<number, number>>({});

  const workoutSteps = useMemo<WorkoutStep[]>(() => {
    if (!workout) return [];

    return workout.exercises.flatMap((exercise, exerciseIndex) =>
      exercise.sets.map((set, setIndex) => ({
        exercise,
        exerciseIndex,
        set,
        setIndex,
      }))
    );
  }, [workout]);

  const workoutStepGroups = useMemo<WorkoutStepGroup[]>(() => {
    if (!workout) return [];

    let globalIndex = 0;

    return workout.exercises.map((exercise, exerciseIndex) => {
      const steps = exercise.sets.map((set, setIndex) => {
        const step = {
          exercise,
          exerciseIndex,
          set,
          setIndex,
          globalIndex,
        } as WorkoutStep & { globalIndex: number };

        globalIndex += 1;
        return step;
      });

      return {
        exercise,
        exerciseIndex,
        steps,
      };
    });
  }, [workout]);

  const activeStep = workoutSteps[activeStepIndex] ?? null;
  const activeExercise = activeStep?.exercise ?? null;
  const activeSet = activeStep?.set ?? null;
  const activeTimer = activeSet
    ? timers[activeSet.id] ?? {
        phase: "idle" as const,
        isRunning: false,
        remainingSeconds: activeSet.duration_seconds ?? 0,
      }
    : null;
  const hasReps = activeExercise
    ? activeExercise.sets.some((set) => set.reps !== null)
    : false;
  const hasWeight = activeExercise
    ? activeExercise.sets.some((set) => set.weight !== null)
    : false;
  const hasDuration = activeExercise
    ? activeExercise.sets.some((set) => set.duration_seconds !== null)
    : false;
  const hasTimer =
    activeSet?.duration_seconds !== null &&
    activeSet?.duration_seconds !== undefined &&
    activeSet.duration_seconds > 0;
  const isTimerActive =
    activeTimer !== null &&
    (activeTimer.phase === "prep" || activeTimer.phase === "work") &&
    activeTimer.isRunning;
  const isFirstStep = activeStepIndex === 0;
  const isLastStep =
    workoutSteps.length > 0 && activeStepIndex === workoutSteps.length - 1;
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
          setActiveStepIndex(0);
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
          sets: exercise.sets.map((set) => (set.id === setId ? nextSet : set)),
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

  async function completeSet(set: WorkoutSet) {
    if (set.completed) return true;

    try {
      const updated = await api.updateSet(set.id, {
        completed: true,
      });
      updateSet(set.id, updated);
      return true;
    } catch {
      setError("No se pudo marcar la serie.");
      return false;
    }
  }

  async function completeActiveSet(set: WorkoutSet) {
    const completed = await completeSet(set);

    if (completed) {
      setActiveStepIndex((current) =>
        Math.min(current + 1, Math.max(workoutSteps.length - 1, 0))
      );
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
        void completeActiveSet(set);
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

    void completeActiveSet(set);
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

  function goToPreviousStep() {
    setActiveStepIndex((current) => Math.max(current - 1, 0));
  }

  function goToNextStep() {
    if (!activeSet?.completed) return;

    setActiveStepIndex((current) =>
      Math.min(current + 1, workoutSteps.length - 1)
    );
  }

  function selectStep(index: number) {
    const nextStep = workoutSteps[index];

    if (!nextStep) return;

    if (
      index <= activeStepIndex ||
      nextStep.set.completed ||
      activeSet?.completed
    ) {
      setActiveStepIndex(index);
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
      ) : workoutSteps.length === 0 ? (
        <section className="empty-state">Este workout no tiene series.</section>
      ) : (
        <>
          <section className="mobile-card workout-summary">
            <span>{workout.status}</span>
            <strong>{new Date(workout.date).toLocaleString()}</strong>
          </section>

          <section className="mobile-card workout-step-progress">
            <div className="workout-step-summary">
              <span>
                Ejercicio {activeExercise?.order_index ?? 0} de {workout.exercises.length}
              </span>
            </div>
            <div className="workout-step-dots">
              {workoutStepGroups.map((group) => {
                const isDone = group.steps.every((s) => s.set.completed);
                const firstIndex = group.steps[0]?.globalIndex ?? 0;
                const isActive = activeStep?.exerciseIndex === group.exerciseIndex;

                return (
                  <button
                    aria-label={`Ir al ejercicio ${group.exercise.order_index}`}
                    className={`${isActive ? "active" : ""} ${isDone ? "done" : ""}`}
                    disabled={
                      firstIndex > activeStepIndex &&
                      !isDone &&
                      !activeSet?.completed
                    }
                    key={group.exercise.id}
                    onClick={() => selectStep(firstIndex)}
                    type="button"
                  />
                );
              })}
            </div>
          </section>

          {activeExercise && activeStep && activeSet && activeTimer ? (
            <section className="workout-step-card active-set-card">
              <div className="workout-exercise">
                <div className="workout-exercise-header">
                  <span>{activeExercise.order_index}</span>
                  <strong>{activeExercise.exercise_name}</strong>
                </div>

                <div className={`active-set-body timer-${activeTimer.phase}`}>
                  <div className="active-set-progress">
                    <span>
                      Serie {activeStep.setIndex + 1} de {activeExercise.sets.length}
                    </span>
                  </div>

                  <div className="series-indicators" aria-hidden="true">
                    {activeExercise.sets.map((set, index) => (
                      <span
                        className={`series-dot ${
                          set.completed ? "done" : "pending"
                        } ${index === activeStep.setIndex ? "active" : ""}`}
                        key={set.id}
                      />
                    ))}
                  </div>

                  <div className="active-set-fields">
                    {hasReps ? (
                      <label className="active-field">
                        <span>Repeticiones</span>
                        <input
                          min={0}
                          type="number"
                          value={activeSet.reps ?? ""}
                          onBlur={() => saveSet(activeSet, "reps")}
                          onChange={(event) =>
                            updateSetDraft(
                              activeSet.id,
                              "reps",
                              event.target.value === ""
                                ? null
                                : Number(event.target.value)
                            )
                          }
                        />
                      </label>
                    ) : null}

                    {hasWeight ? (
                      <label className="active-field">
                        <span>Peso</span>
                        <input
                          min={0}
                          step="0.5"
                          type="number"
                          value={activeSet.weight ?? ""}
                          onBlur={() => saveSet(activeSet, "weight")}
                          onChange={(event) =>
                            updateSetDraft(
                              activeSet.id,
                              "weight",
                              event.target.value === ""
                                ? null
                                : Number(event.target.value)
                            )
                          }
                        />
                      </label>
                    ) : null}

                    {hasDuration ? (
                      <label className="active-field">
                        <span>Tiempo</span>
                        <DurationInput
                          value={activeSet.duration_seconds}
                          onBlur={() => saveSet(activeSet, "duration_seconds")}
                          onChange={(value) =>
                            updateSetDraft(
                              activeSet.id,
                              "duration_seconds",
                              value
                            )
                          }
                        />
                      </label>
                    ) : null}
                  </div>

                  {hasTimer ? (
                    <div className="big-timer-card">
                      <div className="big-timer-display">
                        {activeTimer.phase === "prep"
                          ? `Prep ${activeTimer.remainingSeconds}s`
                          : activeTimer.phase === "done"
                          ? "Completado"
                          : formatTimer(activeTimer.remainingSeconds)}
                      </div>
                      <div className="big-timer-actions">
                        <button
                          aria-label="Iniciar temporizador"
                          disabled={
                            workout.status === "completed" ||
                            saving ||
                            isTimerActive ||
                            activeTimer.phase === "done"
                          }
                          onClick={() => startTimer(activeSet)}
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
                          onClick={() => pauseTimer(activeSet.id)}
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
                            activeTimer.phase === "done"
                          }
                          onClick={() => finishTimer(activeSet)}
                          title="Terminar"
                          type="button"
                        >
                          ✓
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <button
                    className="primary-action complete-set-button"
                    disabled={
                      workout.status === "completed" ||
                      saving ||
                      activeSet.completed
                    }
                    onClick={() => completeActiveSet(activeSet)}
                    type="button"
                  >
                    {activeSet.completed ? "Serie completada" : "Completar serie"}
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {activeExercise && !activeExerciseCompleted ? (
            <p className="workout-step-hint">Completa esta serie para avanzar.</p>
          ) : null}

          <section className="workout-step-actions">
            <button
              className="secondary-action"
              disabled={isFirstStep || saving}
              onClick={goToPreviousStep}
              type="button"
            >
              Anterior
            </button>

            {isLastStep ? (
              <button
                className="primary-action"
                disabled={
                  workout.status === "completed" || saving || !activeSet?.completed
                }
                onClick={finishWorkout}
                type="button"
              >
                Finalizar sesion
              </button>
            ) : (
              <button
                className="primary-action"
                disabled={saving || !activeSet?.completed}
                onClick={goToNextStep}
                type="button"
              >
                Siguiente serie
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
