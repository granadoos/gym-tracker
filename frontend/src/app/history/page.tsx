"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WorkoutSummary, PlanDay, TrainingPlan, api } from "@/lib/api";

function formatWorkoutDate(value: string) {
  const date = new Date(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);

  return `${day}/${month}/${year}`;
}

function getStatusBadge(status: string) {
  if (status === "completed") {
    return { icon: "✅", label: "Completado" };
  }

  return { icon: "⏳", label: "En curso" };
}

export default function HistoryPage() {
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);
  const [planDays, setPlanDays] = useState<PlanDay[]>([]);
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadWorkouts() {
      try {
        setError(null);
        const [workoutData, planDayData, planData] = await Promise.all([
          api.getWorkouts(),
          api.getPlanDays(),
          api.getPlans(),
        ]);

        if (!isActive) return;

        setWorkouts(workoutData);
        setPlanDays(planDayData);
        setPlans(planData);
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

  return (
    <main className="history-shell">
      <header className="mobile-header">
        <div>
          <p className="eyebrow">Gym Tracker</p>
          <h1>Historico</h1>
        </div>
        <Link className="header-link" href="/">
          ⬅
        </Link>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="mobile-card history-list-panel">
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

        {loadingList ? (
          <div className="empty-state">Cargando historico...</div>
        ) : workouts.length === 0 ? (
          <div className="empty-state">Aun no hay workouts realizados.</div>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Planes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {workouts.map((workout) => {
                const planDay = workout.plan_day_id
                  ? planDays.find((day) => day.id === workout.plan_day_id)
                  : null;
                const plan = planDay
                  ? plans.find((item) => item.id === planDay.plan_id)
                  : null;

                const tipo = plan?.name ?? "-";

                return (
                  <tr key={workout.id} className="history-row">
                    <td>{formatWorkoutDate(workout.date)}</td>
                    <td>{tipo}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {getStatusBadge(workout.status).icon}
                        <Link href={`/history/${workout.id}`}>
                          <button type="button" className="icon-button" aria-label={`Ver detalle workout ${workout.id}`} title="Ver detalle">
                            👁
                          </button>
                        </Link>
                        <button
                          type="button"
                          className="icon-button danger"
                          onClick={async () => {
                            const ok = confirm(`Borrar workout #${workout.id}?`);
                            if (!ok) return;

                            try {
                              setError(null);
                              await api.deleteWorkout(workout.id);
                              setWorkouts((prev) => prev.filter((w) => w.id !== workout.id));
                            } catch {
                              setError("No se pudo borrar el workout.");
                            }
                          }}
                        >
                          x
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
