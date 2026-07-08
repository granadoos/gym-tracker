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

type RestTimer = {
  isRunning: boolean;
  remainingSeconds: number;
  done: boolean;
};

type ExerciseWorkoutStep = {
  type: "exercise";
  exercise: WorkoutExerciseFull;
  exerciseIndex: number;
  set: WorkoutSet;
  setIndex: number;
  roundIndex: number | null;
  totalRounds: number | null;
};

type RestWorkoutStep = {
  type: "rest";
  roundIndex: number;
  totalRounds: number;
  seconds: number;
};

type WorkoutStep = ExerciseWorkoutStep | RestWorkoutStep;

type WorkoutStepGroup = {
  key: string;
  label: string;
  firstIndex: number;
  isDone: boolean;
  isActive: boolean;
};

function formatTimer(seconds: number) {
  const safeSeconds = Math.max(seconds, 0);
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;

  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

let audioContextInstance: AudioContext | null = null;

function initAudioContext() {
  const audioWindow = window as Window & {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextClass =
    audioWindow.AudioContext || audioWindow.webkitAudioContext;

  if (!AudioContextClass) return null;

  if (!audioContextInstance) {
    audioContextInstance = new AudioContextClass();
  }

  // Resume audio context if suspended (iOS)
  if (audioContextInstance.state === 'suspended') {
    audioContextInstance.resume().catch(() => {
      // Silent catch for iOS
    });
  }

  return audioContextInstance;
}

function ringBell() {
  // Intentar primero con Web Audio API
  const audioContext = initAudioContext();
  
  if (audioContext) {
    try {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(660, audioContext.currentTime + 0.16);
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime + 0.4);
      gain.gain.setValueAtTime(0.001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.35, audioContext.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.75);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.75);
      return;
    } catch (error) {
      console.warn('Web Audio API failed:', error);
    }
  }

  // Fallback: usar elemento de audio HTML
  const audioElement = new Audio();
  audioElement.volume = 0.3;
  
  const sampleRate = 44100;
  const duration = 0.75;
  const frequency1 = 880;
  const frequency2 = 660;
  const frequency3 = 440;
  const firstChange = 0.16;
  const secondChange = 0.4;
  
  const samples = generateAudioSamples(
    sampleRate,
    duration,
    frequency1,
    frequency2,
    frequency3,
    firstChange,
    secondChange
  );
  const blob = new Blob([samples.buffer as ArrayBuffer], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  
  audioElement.src = url;
  audioElement.play().catch((error) => {
    console.warn('Audio playback failed:', error);
  });
  
  audioElement.onended = () => {
    URL.revokeObjectURL(url);
  };
}

function generateAudioSamples(
  sampleRate: number,
  duration: number,
  freq1: number,
  freq2: number,
  freq3: number,
  firstChange: number,
  secondChange: number
): Uint8Array {
  const totalSamples = Math.floor(sampleRate * duration);
  const firstChangePoint = Math.floor(sampleRate * firstChange);
  const secondChangePoint = Math.floor(sampleRate * secondChange);
  
  const audioBuffer = new Float32Array(totalSamples);
  
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let frequency = freq1;

    if (i >= secondChangePoint) {
      frequency = freq3;
    } else if (i >= firstChangePoint) {
      frequency = freq2;
    }
    
    // Envelope: fade in then fade out
    let envelope = 0;
    if (t < 0.02) {
      envelope = t / 0.02; // Fade in
    } else if (t < duration - 0.05) {
      envelope = 1;
    } else {
      envelope = Math.max(0, (duration - t) / 0.05); // Fade out
    }
    
    const sample = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.3;
    audioBuffer[i] = sample;
  }
  
  return encodeWAV(audioBuffer, sampleRate);
}

function encodeWAV(samples: Float32Array, sampleRate: number): Uint8Array {
  const channelData = [samples];
  const format = 1; // PCM
  const numChannels = 1;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataLength = samples.length * blockAlign;
  const fileLength = 36 + dataLength;

  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, fileLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  // Audio samples
  let offset = 44;
  const volume = 0.8;
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i] * volume;
    const s = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

export default function WorkoutPage() {
  const params = useParams<{ workoutId: string }>();
  const workoutId = Number(params.workoutId);
  const [workout, setWorkout] = useState<WorkoutFull | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [timers, setTimers] = useState<Record<number, SetTimer>>({});
  const [restTimers, setRestTimers] = useState<Record<number, RestTimer>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerIntervals = useRef<Record<number, number>>({});
  const restTimerIntervals = useRef<Record<number, number>>({});

  const workoutSteps = useMemo<WorkoutStep[]>(() => {
    if (!workout) return [];

    if (workout.workout_type !== "circuit") {
      return workout.exercises.flatMap((exercise, exerciseIndex) =>
        exercise.sets.map((set, setIndex) => ({
          type: "exercise",
          exercise,
          exerciseIndex,
          set,
          setIndex,
          roundIndex: null,
          totalRounds: null,
        }))
      );
    }

    const steps: WorkoutStep[] = [];
    const totalRounds = Math.max(
      0,
      ...workout.exercises.map((exercise) => exercise.sets.length)
    );
    const restSeconds = workout.circuit_rest_seconds ?? 0;

    for (let roundIndex = 0; roundIndex < totalRounds; roundIndex += 1) {
      workout.exercises.forEach((exercise, exerciseIndex) => {
        const set = exercise.sets[roundIndex];

        if (!set) return;

        steps.push({
          type: "exercise",
          exercise,
          exerciseIndex,
          set,
          setIndex: roundIndex,
          roundIndex,
          totalRounds,
        });
      });

      if (restSeconds > 0 && roundIndex < totalRounds - 1) {
        steps.push({
          type: "rest",
          roundIndex,
          totalRounds,
          seconds: restSeconds,
        });
      }
    }

    return steps;
  }, [workout]);

  const activeStep = workoutSteps[activeStepIndex] ?? null;

  const workoutStepGroups = useMemo<WorkoutStepGroup[]>(() => {
    if (!workout) return [];

    if (workout.workout_type === "circuit") {
      const totalRounds = Math.max(
        0,
        ...workout.exercises.map((exercise) => exercise.sets.length)
      );

      return Array.from({ length: totalRounds }, (_, roundIndex) => {
        const firstIndex = workoutSteps.findIndex(
          (step) => step.roundIndex === roundIndex
        );
        const isDone = workout.exercises.every((exercise) => {
          const set = exercise.sets[roundIndex];

          return !set || set.completed;
        });
        const isActive =
          activeStep?.type === "exercise"
            ? activeStep.roundIndex === roundIndex
            : activeStep?.type === "rest" &&
              activeStep.roundIndex === roundIndex;

        return {
          key: `round-${roundIndex}`,
          label: `Ronda ${roundIndex + 1}`,
          firstIndex: firstIndex === -1 ? 0 : firstIndex,
          isDone,
          isActive,
        };
      });
    }

    return workout.exercises.map((exercise, exerciseIndex) => {
      const firstIndex = workoutSteps.findIndex(
        (step) =>
          step.type === "exercise" && step.exerciseIndex === exerciseIndex
      );

      return {
        key: `exercise-${exercise.id}`,
        label: exercise.exercise_name,
        firstIndex: firstIndex === -1 ? 0 : firstIndex,
        isDone:
          exercise.sets.length > 0 &&
          exercise.sets.every((set) => set.completed),
        isActive:
          activeStep?.type === "exercise" &&
          activeStep.exerciseIndex === exerciseIndex,
      };
    });
  }, [activeStep, workout, workoutSteps]);

  const activeExercise =
    activeStep?.type === "exercise" ? activeStep.exercise : null;
  const activeSet = activeStep?.type === "exercise" ? activeStep.set : null;
  const currentRoundExerciseSteps = useMemo(() => {
    if (
      !workout ||
      workout.workout_type !== "circuit" ||
      activeStep?.type !== "exercise" ||
      activeStep.roundIndex === null
    ) {
      return [];
    }

    return workoutSteps.filter(
      (step): step is ExerciseWorkoutStep =>
        step.type === "exercise" && step.roundIndex === activeStep.roundIndex
    );
  }, [activeStep, workout, workoutSteps]);
  const currentRoundExerciseIndex =
    activeStep?.type === "exercise" && activeStep.roundIndex !== null
      ? currentRoundExerciseSteps.findIndex(
          (step) =>
            step.exerciseIndex === activeStep.exerciseIndex &&
            step.roundIndex === activeStep.roundIndex
        )
      : -1;
  const activeRestTimer =
    activeStep?.type === "rest"
      ? restTimers[activeStepIndex] ?? {
          isRunning: false,
          remainingSeconds: activeStep.seconds,
          done: false,
        }
      : null;
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
    const restIntervals = restTimerIntervals.current;

    return () => {
      Object.values(intervals).forEach((intervalId) => {
        window.clearInterval(intervalId);
      });
      Object.values(restIntervals).forEach((intervalId) => {
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
    setId: number,
    field: "reps" | "weight" | "duration_seconds",
    value: number | null
  ) {
    setSaving(true);
    setError(null);

    try {
      const updated = await api.updateSet(setId, {
        [field]: value,
      });
      updateSet(setId, updated);
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

    // Initialize audio context on user interaction (required for iOS)
    initAudioContext();

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

  function completeRestStep(stepIndex: number) {
    window.clearInterval(restTimerIntervals.current[stepIndex]);
    delete restTimerIntervals.current[stepIndex];

    setRestTimers((current) => ({
      ...current,
      [stepIndex]: {
        isRunning: false,
        remainingSeconds: 0,
        done: true,
      },
    }));

    ringBell();
    setActiveStepIndex((current) =>
      Math.min(current + 1, Math.max(workoutSteps.length - 1, 0))
    );
  }

  function startRestTimer(stepIndex: number, totalSeconds: number) {
    if (totalSeconds <= 0) {
      completeRestStep(stepIndex);
      return;
    }

    initAudioContext();

    const currentTimer = restTimers[stepIndex];
    let remainingSeconds =
      currentTimer && !currentTimer.done
        ? currentTimer.remainingSeconds
        : totalSeconds;

    setRestTimers((current) => ({
      ...current,
      [stepIndex]: {
        isRunning: true,
        remainingSeconds,
        done: false,
      },
    }));

    window.clearInterval(restTimerIntervals.current[stepIndex]);
    restTimerIntervals.current[stepIndex] = window.setInterval(() => {
      remainingSeconds -= 1;

      if (remainingSeconds <= 0) {
        completeRestStep(stepIndex);
        return;
      }

      setRestTimers((current) => ({
        ...current,
        [stepIndex]: {
          isRunning: true,
          remainingSeconds,
          done: false,
        },
      }));
    }, 1000);
  }

  function pauseRestTimer(stepIndex: number) {
    window.clearInterval(restTimerIntervals.current[stepIndex]);
    delete restTimerIntervals.current[stepIndex];

    setRestTimers((current) => {
      const currentTimer = current[stepIndex];
      if (!currentTimer) return current;

      return {
        ...current,
        [stepIndex]: {
          ...currentTimer,
          isRunning: false,
        },
      };
    });
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
    if (!isActiveStepComplete()) return;

    setActiveStepIndex((current) =>
      Math.min(current + 1, workoutSteps.length - 1)
    );
  }

  function isStepDone(step: WorkoutStep, index: number) {
    if (step.type === "exercise") {
      return step.set.completed;
    }

    return restTimers[index]?.done ?? false;
  }

  function isActiveStepComplete() {
    if (!activeStep) return false;

    return isStepDone(activeStep, activeStepIndex);
  }

  function selectStep(index: number) {
    const nextStep = workoutSteps[index];

    if (!nextStep) return;

    if (
      index <= activeStepIndex ||
      isStepDone(nextStep, index) ||
      isActiveStepComplete()
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
                {workout.workout_type === "circuit" && activeStep
                  ? activeStep.type === "rest"
                    ? `Descanso ronda ${activeStep.roundIndex + 1}`
                    : `Ronda ${
                        activeStep.roundIndex !== null
                          ? activeStep.roundIndex + 1
                          : 1
                      } de ${activeStep.totalRounds ?? 1}`
                  : `Ejercicio ${activeExercise?.order_index ?? 0} de ${
                      workout.exercises.length
                    }`}
              </span>
            </div>
            <div className="workout-step-dots">
              {workoutStepGroups.map((group) => {
                return (
                  <button
                    aria-label={`Ir a ${group.label}`}
                    className={`${group.isActive ? "active" : ""} ${
                      group.isDone ? "done" : ""
                    }`}
                    disabled={
                      group.firstIndex > activeStepIndex &&
                      !group.isDone &&
                      !isActiveStepComplete()
                    }
                    key={group.key}
                    onClick={() => selectStep(group.firstIndex)}
                    type="button"
                  />
                );
              })}
            </div>

            {workout.workout_type === "circuit" &&
            currentRoundExerciseSteps.length > 0 &&
            activeStep?.type === "exercise" ? (
              <div className="workout-step-progress workout-step-progress-secondary">
                <div className="workout-step-summary">
                  <span>
                    Ejercicio {currentRoundExerciseIndex + 1} de {currentRoundExerciseSteps.length}
                  </span>
                </div>
                <div className="workout-step-dots">
                  {currentRoundExerciseSteps.map((step, index) => {
                    const isActive =
                      activeStep?.type === "exercise" &&
                      step.exerciseIndex === activeStep.exerciseIndex &&
                      step.roundIndex === activeStep.roundIndex;
                    const isDone = step.set.completed;

                    return (
                      <button
                        aria-label={`Ejercicio ${index + 1} de ${currentRoundExerciseSteps.length}`}
                        className={`${isActive ? "active" : ""} ${
                          isDone ? "done" : ""
                        }`}
                        key={`${step.roundIndex}-${step.exerciseIndex}`}
                        type="button"
                      />
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>

          {activeExercise && activeStep?.type === "exercise" && activeSet && activeTimer ? (
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
                          onBlur={() =>
                            saveSet(
                              activeSet.id,
                              "reps",
                              activeSet.reps ?? null
                            )
                          }
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
                          onBlur={() =>
                            saveSet(
                              activeSet.id,
                              "weight",
                              activeSet.weight ?? null
                            )
                          }
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
                          onBlur={(value) =>
                            saveSet(activeSet.id, "duration_seconds", value)
                          }
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

          {activeStep?.type === "rest" && activeRestTimer ? (
            <section className="workout-step-card active-set-card">
              <div className="workout-exercise">
                <div className="workout-exercise-header">
                  <span>{activeStep.roundIndex + 1}</span>
                  <strong>Descanso entre circuitos</strong>
                </div>

                <div className="active-set-body timer-work">
                  <div className="active-set-progress">
                    <span>
                      Ronda {activeStep.roundIndex + 1} de{" "}
                      {activeStep.totalRounds}
                    </span>
                  </div>

                  <div className="big-timer-card">
                    <div className="big-timer-display">
                      {activeRestTimer.done
                        ? "Completado"
                        : formatTimer(activeRestTimer.remainingSeconds)}
                    </div>
                    <div className="big-timer-actions">
                      <button
                        aria-label="Iniciar descanso"
                        disabled={
                          workout.status === "completed" ||
                          saving ||
                          activeRestTimer.isRunning ||
                          activeRestTimer.done
                        }
                        onClick={() =>
                          startRestTimer(activeStepIndex, activeStep.seconds)
                        }
                        title="Iniciar"
                        type="button"
                      >
                        ▶
                      </button>
                      <button
                        aria-label="Pausar descanso"
                        disabled={
                          workout.status === "completed" ||
                          saving ||
                          !activeRestTimer.isRunning
                        }
                        onClick={() => pauseRestTimer(activeStepIndex)}
                        title="Pausar"
                        type="button"
                      >
                        ||
                      </button>
                      <button
                        aria-label="Terminar descanso"
                        disabled={
                          workout.status === "completed" ||
                          saving ||
                          activeRestTimer.done
                        }
                        onClick={() => completeRestStep(activeStepIndex)}
                        title="Terminar"
                        type="button"
                      >
                        ✓
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {activeStep?.type === "exercise" && activeExercise && !activeSet?.completed ? (
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
                  workout.status === "completed" ||
                  saving ||
                  !isActiveStepComplete()
                }
                onClick={finishWorkout}
                type="button"
              >
                Finalizar sesion
              </button>
            ) : (
              <button
                className="primary-action"
                disabled={saving || !isActiveStepComplete()}
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
