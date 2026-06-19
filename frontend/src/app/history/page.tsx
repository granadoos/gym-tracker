"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WorkoutSummary, api } from "@/lib/api";

function formatWorkoutDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function HistoryPage() {
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadWorkouts() {
      try {
        setError(null);
        const data = await api.getWorkouts();

        if (!isActive) return;

        setWorkouts(data);
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
          Inicio
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
                <th>ID</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {workouts.map((workout) => (
                <tr key={workout.id} className="history-row">
                  <td>{workout.id}</td>
                  <td>{formatWorkoutDate(workout.date)}</td>
                  <td>{workout.status}</td>
                  <td>
                    <Link
                      href={`/history/${workout.id}`}
                      className="history-row-link"
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
