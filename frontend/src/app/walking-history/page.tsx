"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { WalkingHistoryDay } from "@/lib/api";

function formatDay(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year.slice(-2)}`;
}

export default function WalkingHistoryPage() {
  const [days, setDays] = useState<WalkingHistoryDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadHistory() {
      try {
        setError(null);
        const history = await api.getWalkingHistory();
        if (isActive) setDays(history);
      } catch {
        if (isActive) setError("No se pudo cargar el histórico de kilómetros.");
      } finally {
        if (isActive) setLoading(false);
      }
    }

    void loadHistory();
    return () => {
      isActive = false;
    };
  }, []);

  return (
    <main className="history-shell">
      <header className="mobile-header">
        <div>
          <p className="eyebrow">Km diarios</p>
          <h1>Histórico</h1>
        </div>
        <Link className="header-link" href="/">
          ⬅
        </Link>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="mobile-card history-list-panel">
        <div className="panel-header">
          <div>
            <h2>Kilómetros por día</h2>
            <p>
              {loading ? "Cargando días" : `${days.length} días registrados`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Cargando histórico...</div>
        ) : days.length === 0 ? (
          <div className="empty-state">Aún no hay kilómetros registrados.</div>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Kilómetros</th>
              </tr>
            </thead>
            <tbody>
              {days.map((item) => (
                <tr className="history-row" key={item.day}>
                  <td>{formatDay(item.day)}</td>
                  <td>
                    {item.kilometers.toLocaleString("es-ES", {
                      maximumFractionDigits: 2,
                    })} km
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
