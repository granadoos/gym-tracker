"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { PlanDay, TrainingPlan, WalkingToday, api } from "@/lib/api";
import { inspirationalPhrases } from "@/lib/inspirationalPhrases";

const weekDays = [
  "Lunes",
  "Martes",
  "Miercoles",
  "Jueves",
  "Viernes",
  "Sabado",
  "Domingo",
];

function localDateString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}


function getDailyPhrase() {
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (today.getTime() - startOfYear.getTime()) / 86_400_000
  );

  return inspirationalPhrases[dayOfYear % inspirationalPhrases.length];
}

export default function Home() {
  const router = useRouter();
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [planDays, setPlanDays] = useState<PlanDay[]>([]);
  const [selectedDayId, setSelectedDayId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walking, setWalking] = useState<WalkingToday | null>(null);
  const [activeTab, setActiveTab] = useState<"walking" | "training">("walking");
  const [kilometersInput, setKilometersInput] = useState("");
  const [goalInput, setGoalInput] = useState("6");
  const [walkingBusy, setWalkingBusy] = useState(false);

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

  const selectedDay = planDays.find((day) => day.id === selectedDayId);
  const selectedPlan = plans.find((plan) => plan.id === selectedDay?.plan_id);
  const dailyPhrase = useMemo(() => getDailyPhrase(), []);

  useEffect(() => {
    let isActive = true;

    async function loadHomeData() {
      try {
        setError(null);
        const [planData, dayData, walkingData] = await Promise.all([
          api.getPlans(),
          api.getPlanDays(),
          api.getWalkingToday(localDateString()),
        ]);

        if (!isActive) return;

        setPlans(planData);
        setPlanDays(dayData);
        setSelectedDayId(dayData[0]?.id ?? null);
        setWalking(walkingData);
        setGoalInput(String(walkingData.daily_goal_kilometers));
      } catch {
        if (isActive) {
          setError("No se pudo cargar la informacion.");
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadHomeData();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!walking) return;
    const timer = window.setInterval(() => {
      if (localDateString() !== walking.day) {
        void api.getWalkingToday(localDateString()).then(setWalking).catch(() => {
          setError("No se pudo actualizar el contador diario.");
        });
      }
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [walking]);

  async function handleAddKilometers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const kilometers = Number(kilometersInput);
    if (!walking || !Number.isFinite(kilometers) || kilometers <= 0) return;
    setWalkingBusy(true);
    setError(null);
    const day = localDateString();
    try {
      await api.addWalkingEntry(kilometers, day);
      setWalking(await api.getWalkingToday(day));
      setKilometersInput("");
    } catch {
      setError("No se pudieron guardar los kilómetros.");
    } finally {
      setWalkingBusy(false);
    }
  }

  async function handleSaveGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const goal = Number(goalInput);
    if (!Number.isFinite(goal) || goal <= 0) return;
    setWalkingBusy(true);
    setError(null);
    try {
      await api.updateWalkingGoal(goal);
      setWalking(await api.getWalkingToday(localDateString()));
    } catch {
      setError("No se pudo actualizar la meta diaria.");
    } finally {
      setWalkingBusy(false);
    }
  }

  async function handleDeleteWalkingEntry(entryId: number) {
    setWalkingBusy(true);
    try {
      await api.deleteWalkingEntry(entryId);
      setWalking(await api.getWalkingToday(localDateString()));
    } catch {
      setError("No se pudo borrar el registro.");
    } finally {
      setWalkingBusy(false);
    }
  }

  async function handleStartWorkout() {
    if (!selectedDayId) return;

    setStarting(true);
    setError(null);

    try {
      const started = await api.startWorkout(selectedDayId);
      router.push(`/workout/${started.workout_id}`);
    } catch {
      setError("No se pudo iniciar el workout.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <main className="mobile-shell">
      <header className="mobile-header">
        <div>
          <p className="eyebrow">Gym Tracker</p>
          <h1>{dailyPhrase}</h1>
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="home-tabs" role="tablist" aria-label="Secciones principales">
        <button
          aria-selected={activeTab === "training"}
          className={activeTab === "training" ? "active" : ""}
          id="training-tab"
          onClick={() => setActiveTab("training")}
          role="tab"
          type="button"
        >
          Entrenamiento
        </button>
        <button
          aria-selected={activeTab === "walking"}
          className={activeTab === "walking" ? "active" : ""}
          id="walking-tab"
          onClick={() => setActiveTab("walking")}
          role="tab"
          type="button"
        >
          Km diarios
        </button>
      </div>

      {activeTab === "walking" ? <section
        aria-labelledby="walking-tab"
        className="mobile-card walking-card"
        role="tabpanel"
      >
        <div className="panel-header">
          <div>
            <h2>Objetivo de hoy</h2>
            <p>Registra tus paseos; el contador empieza de nuevo cada día.</p>
          </div>
        </div>
        {walking ? (
          <>
            <div className="walking-total">
              <strong>{walking.kilometers.toLocaleString("es-ES", { maximumFractionDigits: 2 })}</strong>
              <span>de {walking.daily_goal_kilometers.toLocaleString("es-ES", { maximumFractionDigits: 2 })} km</span>
            </div>
            <div
              className="walking-progress-track"
              role="progressbar"
              aria-label="Progreso de kilómetros de hoy"
              aria-valuemin={0}
              aria-valuemax={walking.daily_goal_kilometers}
              aria-valuenow={Math.min(walking.kilometers, walking.daily_goal_kilometers)}
            >
              <span style={{ width: `${Math.min((walking.kilometers / walking.daily_goal_kilometers) * 100, 100)}%` }} />
            </div>
            <p className="walking-remaining">
              {walking.kilometers >= walking.daily_goal_kilometers
                ? "¡Meta diaria cumplida!"
                : `Te faltan ${(walking.daily_goal_kilometers - walking.kilometers).toLocaleString("es-ES", { maximumFractionDigits: 2 })} km`}
            </p>
            <form className="walking-add-form" onSubmit={handleAddKilometers}>
              <label htmlFor="walking-kilometers">Añadir kilómetros</label>
              <div>
                <input id="walking-kilometers" min="0.01" max="100" step="0.01" type="number" placeholder="Ej. 2,5" value={kilometersInput} onChange={(event) => setKilometersInput(event.target.value)} required />
                <button className="primary-action" disabled={walkingBusy || !kilometersInput} type="submit">Añadir</button>
              </div>
            </form>
            {walking.entries.length > 0 ? (
              <ul className="walking-entry-list">
                {walking.entries.map((entry) => (
                  <li key={entry.id}>
                    <span>{entry.kilometers.toLocaleString("es-ES", { maximumFractionDigits: 2 })} km</span>
                    <button className="icon-button danger" disabled={walkingBusy} onClick={() => void handleDeleteWalkingEntry(entry.id)} type="button" aria-label={`Borrar ${entry.kilometers} kilómetros`}>×</button>
                  </li>
                ))}
              </ul>
            ) : null}
            <form className="walking-goal-form" onSubmit={handleSaveGoal}>
              <label htmlFor="walking-goal">Meta diaria</label>
              <input id="walking-goal" min="0.1" max="1000" step="0.1" type="number" value={goalInput} onChange={(event) => setGoalInput(event.target.value)} required />
              <span>km</span>
              <button className="secondary-action" disabled={walkingBusy || Number(goalInput) === walking.daily_goal_kilometers} type="submit">Guardar meta</button>
            </form>
            <Link className="secondary-link-action walking-history-link" href="/walking-history">
              Ver histórico
            </Link>
          </>
        ) : <div className="empty-state">Cargando contador...</div>}
      </section> : null}

      {activeTab === "training" ? <>
      <section aria-labelledby="training-tab" className="mobile-card" role="tabpanel">
        <div className="panel-header">
          <div>
            <h2>Elige el dia</h2>
            <p>
              {selectedDay
                ? `${weekDays[selectedDay.day_of_week]} - ${
                    selectedPlan?.name ?? "Sin plan"
                  }`
                : loading
                ? "Cargando dias"
                : "No hay dias configurados"}
            </p>
          </div>
        </div>

        <div className="day-picker">
          {sortedPlanDays.map((day) => {
            const plan = plans.find((item) => item.id === day.plan_id);

            return (
              <button
                className={`day-choice ${
                  day.id === selectedDayId ? "selected" : ""
                }`}
                key={day.id}
                onClick={() => setSelectedDayId(day.id)}
                type="button"
              >
                <span>{weekDays[day.day_of_week]}</span>
                <small>{plan?.name ?? "Sin plan"}</small>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mobile-actions">
        <button
          className="primary-action"
          disabled={!selectedDayId || !selectedPlan || starting}
          onClick={handleStartWorkout}
          type="button"
        >
          {starting ? "Iniciando..." : "Start workout"}
        </button>
        <Link className="secondary-link-action" href="/configuration">
          Configuracion
        </Link>
        <Link className="secondary-link-action" href="/history">
          Historico
        </Link>
      </section>
      </> : null}
    </main>
  );
}
