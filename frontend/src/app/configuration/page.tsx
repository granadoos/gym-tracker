import Link from "next/link";

export default function ConfigurationPage() {
  return (
    <main className="mobile-shell">
      <header className="mobile-header">
        <div>
          <p className="eyebrow">Gym Tracker</p>
          <h1>Configuracion</h1>
        </div>
        <Link className="header-link" href="/">
          ⬅
        </Link>
      </header>

      <section className="config-menu">
        <Link className="config-menu-item" href="/configuration/catalog">
          <span>Catalogo de ejercicios</span>
          <small>Crear, seleccionar y borrar ejercicios base.</small>
        </Link>

        <Link className="config-menu-item" href="/configuration/days">
          <span>Dias</span>
          <small>Gestionar planes y asignarlos a cada dia.</small>
        </Link>

        <Link className="config-menu-item" href="/configuration/day-exercises">
          <span>Ejercicios por dia</span>
          <small>Configurar ejercicios, series, reps y duracion.</small>
        </Link>
      </section>
    </main>
  );
}
