"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PlanDay, TrainingPlan, api } from "@/lib/api";

const weekDays = [
  "Lunes",
  "Martes",
  "Miercoles",
  "Jueves",
  "Viernes",
  "Sabado",
  "Domingo",
];

export default function Home() {
  const router = useRouter();
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [planDays, setPlanDays] = useState<PlanDay[]>([]);
  const [selectedDayId, setSelectedDayId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    let isActive = true;

    async function loadHomeData() {
      try {
        setError(null);
        const [planData, dayData] = await Promise.all([
          api.getPlans(),
          api.getPlanDays(),
        ]);

        if (!isActive) return;

        setPlans(planData);
        setPlanDays(dayData);
        setSelectedDayId(dayData[0]?.id ?? null);
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
          <h1>Entrenar. Hoy puedes!. </h1>
        </div>
        <Link className="header-link" href="/configuration">
          Configuracion
        </Link>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="mobile-card">
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
    </main>
  );
}
