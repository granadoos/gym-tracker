"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Exercise,
  PlanDay,
  PlanExercise,
  TrainingPlan,
  api,
} from "@/lib/api";
import { formatDuration } from "@/lib/formatter";
import DurationInput from "@/components/DurationInput";

const weekDays = [
  "Lunes",
  "Martes",
  "Miercoles",
  "Jueves",
  "Viernes",
  "Sabado",
  "Domingo",
];

type ConfigurationBuilderProps = {
  view: "catalog" | "days" | "day-exercises";
};

export default function ConfigurationBuilder({
  view,
}: ConfigurationBuilderProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [planDays, setPlanDays] = useState<PlanDay[]>([]);
  const [planExercises, setPlanExercises] = useState<PlanExercise[]>([]);

  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [exerciseName, setExerciseName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [planName, setPlanName] = useState("");
  const [exerciseId, setExerciseId] = useState<number | null>(null);
  const [defaultSets, setDefaultSets] = useState(3);
  const [defaultReps, setDefaultReps] = useState<number | "">(10);
  const [defaultWeight, setDefaultWeight] = useState<number | "">("");
  const [defaultTimeSeconds, setDefaultTimeSeconds] =  useState<number | null>(null);

  const selectedDay = planDays.find((day) => day.id === selectedDayId);
  const selectedPlan = plans.find((plan) => plan.id === selectedDay?.plan_id);

  const sortedPlanDays = useMemo(
    () =>
      [...planDays].sort((first, second) => {
        if (first.day_of_week !== second.day_of_week) {
          return first.day_of_week - second.day_of_week;
        }

        const firstPlanName =
          plans.find((plan) => plan.id === first.plan_id)?.name ?? "";
        const secondPlanName =
          plans.find((plan) => plan.id === second.plan_id)?.name ?? "";

        return firstPlanName.localeCompare(secondPlanName);
      }),
    [planDays, plans]
  );

  async function loadPlanExercises(planDayId: number | null) {
    if (!planDayId) {
      setPlanExercises([]);
      return;
    }

    const data = await api.getPlanExercises(planDayId);
    setPlanExercises(data);
  }

  useEffect(() => {
    let isActive = true;

    async function loadInitialData() {
      try {
        setError(null);
        const [exerciseData, planData, dayData] = await Promise.all([
          api.getExercises(),
          api.getPlans(),
          api.getPlanDays(),
        ]);

        if (!isActive) return;

        const nextDayId = dayData[0]?.id ?? null;
        const nextPlanId =
          dayData.find((day) => day.id === nextDayId)?.plan_id ??
          planData[0]?.id ??
          null;

        setExercises(exerciseData);
        setPlans(planData);
        setPlanDays(dayData);
        setSelectedPlanId(nextPlanId);
        setSelectedDayId(nextDayId);
      } catch {
        if (isActive) {
          setError("No se pudo conectar con el backend.");
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadSelectedDayExercises() {
      if (!selectedDayId) {
        setPlanExercises([]);
        return;
      }

      try {
        const data = await api.getPlanExercises(selectedDayId);
        if (isActive) {
          setPlanExercises(data);
        }
      } catch {
        if (isActive) {
          setError("No se pudieron cargar los ejercicios del dia.");
        }
      }
    }

    void loadSelectedDayExercises();

    return () => {
      isActive = false;
    };
  }, [selectedDayId]);

  function selectDay(day: PlanDay) {
    setSelectedDayId(day.id);
    setSelectedPlanId(day.plan_id);
  }

  async function handleCreateExercise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!exerciseName.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const created = await api.createExercise({
        name: exerciseName.trim(),
        muscle_group: muscleGroup.trim() || "General",
      });
      setExercises((current) => [...current, created]);
      setExerciseId(created.id);
      setExerciseName("");
      setMuscleGroup("");
    } catch {
      setError("No se pudo crear el ejercicio.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreatePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!planName.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const created = await api.createPlan({ name: planName.trim() });
      setPlans((current) => [...current, created]);
      setSelectedPlanId(created.id);
      setPlanName("");
    } catch {
      setError("No se pudo crear el plan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePlan(planId: number) {
    const plan = plans.find((item) => item.id === planId);
    const confirmed = window.confirm(
      `Borrar ${plan?.name ?? "este plan"}? Se quitara de sus dias.`
    );

    if (!confirmed) return;

    setSaving(true);
    setError(null);

    try {
      await api.deletePlan(planId);
      const nextPlans = plans.filter((item) => item.id !== planId);
      const nextPlanDays = planDays.filter((day) => day.plan_id !== planId);
      const nextDayId =
        selectedDay?.plan_id === planId
          ? nextPlanDays[0]?.id ?? null
          : selectedDayId;
      const nextPlanId =
        selectedPlanId === planId
          ? nextPlanDays.find((day) => day.id === nextDayId)?.plan_id ??
            nextPlans[0]?.id ??
            null
          : selectedPlanId;

      setPlans(nextPlans);
      setPlanDays(nextPlanDays);
      setSelectedPlanId(nextPlanId);
      setSelectedDayId(nextDayId);
    } catch {
      setError("No se pudo borrar el plan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateDayPlan(planDayId: number, planId: number | null) {
    setSaving(true);
    setError(null);

    try {
      const updated = await api.updatePlanDayPlan(planDayId, planId);
      setPlanDays((current) =>
        current.map((day) => (day.id === planDayId ? updated : day))
      );
      setSelectedDayId(updated.id);
      setSelectedPlanId(updated.plan_id);
    } catch {
      setError("No se pudo actualizar el plan del dia.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddExerciseToDay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDayId || !exerciseId) return;

    setSaving(true);
    setError(null);

    try {
      await api.createPlanExercise(selectedDayId, {
        exercise_id: exerciseId,
        order_index: planExercises.length + 1,
        default_sets: defaultSets,
        default_reps: defaultReps === "" ? null : defaultReps,
        default_weight: defaultWeight === "" ? null : defaultWeight,
        default_time_seconds: defaultTimeSeconds,
      });
      await loadPlanExercises(selectedDayId);
    } catch {
      setError("No se pudo anadir el ejercicio al dia.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePlanExercise(planExerciseId: number) {
    if (!selectedDayId) return;

    const confirmed = window.confirm("Borrar este ejercicio del dia?");
    if (!confirmed) return;

    setSaving(true);
    setError(null);

    try {
      await api.deletePlanExercise(selectedDayId, planExerciseId);
      setPlanExercises((current) =>
        current.filter((item) => item.id !== planExerciseId)
      );
    } catch {
      setError("No se pudo borrar el ejercicio del dia.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteExercise(exercise: Exercise) {
    const confirmed = window.confirm(`Borrar ${exercise.name} del catalogo?`);
    if (!confirmed) return;

    setSaving(true);
    setError(null);

    try {
      await api.deleteExercise(exercise.id);
      setExercises((current) =>
        current.filter((item) => item.id !== exercise.id)
      );
      setPlanExercises((current) =>
        current.filter((item) => item.exercise_id !== exercise.id)
      );

      if (exerciseId === exercise.id) {
        setExerciseId(null);
      }
    } catch {
      setError("No se pudo borrar el ejercicio. Puede estar usado en workouts.");
    } finally {
      setSaving(false);
    }
  }

  const pageTitle =
    view === "catalog"
      ? "Catalogo de ejercicios"
      : view === "days"
      ? "Dias"
      : "Ejercicios por dia";

  return (
    <main className="mobile-shell config-section-shell">
      <header className="mobile-header">
        <div>
          <p className="eyebrow">Gym Tracker</p>
          <h1>{pageTitle}</h1>
        </div>
        <Link className="header-link" href="/configuration">
          Configuracion
        </Link>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      {view === "days" ? (
        <section className="config-mobile-stack">
          <section className="mobile-card">
            <div className="panel-header">
              <div>
                <h2>Planes</h2>
                <p>{loading ? "Cargando" : `${plans.length} planes`}</p>
              </div>
            </div>

            <form className="compact-form" onSubmit={handleCreatePlan}>
              <input
                placeholder="Nuevo plan"
                value={planName}
                onChange={(event) => setPlanName(event.target.value)}
              />
              <button disabled={saving} type="submit">
                +
              </button>
            </form>

            <div className="form-grid mobile-single-action">
              <select
                value={selectedPlanId ?? ""}
                onChange={(event) => setSelectedPlanId(
                  event.target.value === "" ? null : Number(event.target.value)
                )}
              >
                <option value="">Selecciona plan</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
              <button
                className="danger-action"
                disabled={!selectedPlanId || saving}
                onClick={() =>
                  selectedPlanId && handleDeletePlan(selectedPlanId)
                }
                type="button"
              >
                Borrar plan
              </button>
            </div>
          </section>

          <section className="mobile-card">
            <div className="panel-header">
              <div>
                <h2>Dias</h2>
                <p>Asigna cada dia a un plan</p>
              </div>
            </div>

            <div className="stack-list">
              {sortedPlanDays.map((day) => {
                const plan = plans.find((item) => item.id === day.plan_id);

                return (
                  <div className="config-day-row" key={day.id}>
                    <button
                      className={`list-item ${
                        day.id === selectedDayId ? "selected" : ""
                      }`}
                      onClick={() => selectDay(day)}
                      type="button"
                    >
                      <span>{weekDays[day.day_of_week]}</span>
                      <small>{plan?.name ?? "Sin plan"}</small>
                    </button>
                    <select
                      aria-label={`Plan para ${weekDays[day.day_of_week]}`}
                      className="inline-select"
                      disabled={saving}
                      value={day.plan_id ?? ""}
                      onChange={(event) =>
                        handleUpdateDayPlan(
                          day.id,
                          event.target.value === ""
                            ? null
                            : Number(event.target.value)
                        )
                      }
                    >
                      <option value="">Sin plan</option>
                      {plans.map((planItem) => (
                        <option key={planItem.id} value={planItem.id}>
                          {planItem.name}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </section>
        </section>
      ) : null}

      {view === "day-exercises" ? (
        <section className="config-mobile-stack">
          <section className="mobile-card">
          <div className="panel-header">
            <div>
              <h2>Dia seleccionado</h2>
              <p>
                {selectedDay
                  ? `${weekDays[selectedDay.day_of_week]} - ${
                      selectedPlan?.name ?? "Sin plan"
                    }`
                  : "Selecciona un dia"}
              </p>
            </div>
          </div>
          <div className="day-picker">
            <select
              value={selectedDayId || ""}
              onChange={(e) => {
                const day = sortedPlanDays.find(
                  (d) => d.id === Number(e.target.value)
                );

                if (day) {
                  selectDay(day);
                }
              }}
            >
              <option value="">Selecciona un día</option>

              {sortedPlanDays.map((day) => {
                const plan = plans.find((item) => item.id === day.plan_id);

                return (
                  <option key={day.id} value={day.id}>
                    {weekDays[day.day_of_week]} - {plan?.name ?? "Sin plan"}
                  </option>
                );
              })}
            </select>
          </div>
          </section>

          <section className="mobile-card">
          <div className="panel-header">
            <div>
              <h2>Anadir ejercicio</h2>
              <p>{selectedDay ? weekDays[selectedDay.day_of_week] : "Sin dia"}</p>
            </div>
          </div>

          <form className="builder-form mobile-builder-form" onSubmit={handleAddExerciseToDay}>
            <div className="flex flex-col gap-1">
              <label>Ejercicio</label>  
              <select
                value={exerciseId ?? ""}
                onChange={(event) => setExerciseId(Number(event.target.value))}
              >
                <option value="">Ejercicio</option>
                {exercises.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label>Series</label>  
              <input
                min={1}
                type="number"
                value={defaultSets}
                onChange={(event) => setDefaultSets(Number(event.target.value))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label>Repeticiones</label>
              <input
                min={1}
                placeholder="Reps"
                type="number"
                value={defaultReps}
                onChange={(event) =>
                  setDefaultReps(
                    event.target.value === "" ? "" : Number(event.target.value)
                  )
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <label>Duración</label>
              <DurationInput
                  value={defaultTimeSeconds}
                  onChange={setDefaultTimeSeconds}
                />
            </div>
            <div className="flex flex-col gap-1">
              <label>Peso</label>
              <input
                min={0}
                placeholder="Kg"
                step="0.5"
                type="number"
                value={defaultWeight}
                onChange={(event) =>
                  setDefaultWeight(
                    event.target.value === "" ? "" : Number(event.target.value)
                  )
                }
              />
            </div>
            <div className="flex flex-col justify-end">
              <button disabled={!selectedDayId || !exerciseId || saving} type="submit">
                Anadir
              </button>
            </div>
          </form>
          </section>

          <section className="mobile-card">
            <div className="panel-header">
              <div>
                <h2>Ejercicios del dia</h2>
                <p>
                  {selectedDay
                    ? weekDays[selectedDay.day_of_week]
                    : "Selecciona un dia"}
                </p>
              </div>
            </div>

          <div className="exercise-table">
            <div className="table-row table-head">
              <span>Orden</span>
              <span>Ejercicio</span>
              <span>Series</span>
              <span>Objetivo</span>
              <span>Peso</span>
              <span></span>
            </div>
            {planExercises.map((item) => (
              <div className="table-row" key={item.id}>
                <span>{item.order_index}</span>
                <strong>{item.exercise_name}</strong>
                <span>{item.default_sets}</span>
                <span>
                  {item.default_time_seconds
                    ? `${formatDuration(item.default_time_seconds)}`
                    : `${item.default_reps ?? "-"} reps`}
                </span>
                <span>
                  {item.default_weight !== null
                    ? `${item.default_weight} kg`
                    : "-"}
                </span>
                <button
                  aria-label={`Borrar ${item.exercise_name}`}
                  className="icon-button danger"
                  disabled={saving}
                  onClick={() => handleDeletePlanExercise(item.id)}
                  type="button"
                >
                  x
                </button>
              </div>
            ))}
          </div>
          </section>
        </section>
      ) : null}

      {view === "catalog" ? (
        <section className="config-mobile-stack">
        <section className="mobile-card">
          <div className="panel-header">
            <div>
              <h2>Nuevo ejercicio</h2>
              <p>Crea ejercicios para usar en tus dias</p>
            </div>
          </div>

          <form className="catalog-form" onSubmit={handleCreateExercise}>
            <input
              placeholder="Bench Press"
              value={exerciseName}
              onChange={(event) => setExerciseName(event.target.value)}
            />
            <input
              placeholder="Pecho"
              value={muscleGroup}
              onChange={(event) => setMuscleGroup(event.target.value)}
            />
            <button disabled={saving} type="submit">
              Crear ejercicio
            </button>
          </form>
        </section>

        <section className="mobile-card">
          <div className="panel-header">
            <div>
              <h2>Catalogo</h2>
              <p>{loading ? "Cargando" : `${exercises.length} ejercicios`}</p>
            </div>
          </div>

          <div className="catalog-list">
            {exercises.map((exercise) => (
              <div className="catalog-row" key={exercise.id}>
                <button
                  className={`catalog-item ${
                    exercise.id === exerciseId ? "selected" : ""
                  }`}
                  onClick={() => setExerciseId(exercise.id)}
                  type="button"
                >
                  <span>{exercise.name}</span>
                  <small>{exercise.muscle_group}</small>
                </button>
                <button
                  aria-label={`Borrar ${exercise.name}`}
                  className="icon-button danger"
                  disabled={saving}
                  onClick={() => handleDeleteExercise(exercise)}
                  type="button"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </section>
        </section>
      ) : null}

    </main>
  );
}
