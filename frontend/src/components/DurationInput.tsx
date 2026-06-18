"use client";

import { useEffect, useState } from "react";

import {
  formatDurationInput,
  parseDurationInput,
} from "@/lib/formatter";

type Props = {
  value?: number | null;
  onChange: (seconds: number | null) => void;
  onBlur?: (seconds: number | null) => void;
};

export default function DurationInput({
  value,
  onChange,
  onBlur,
}: Props) {
  const [display, setDisplay] = useState(formatDurationInput(value));
  const [modalOpen, setModalOpen] = useState(false);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    setDisplay(formatDurationInput(value));
  }, [value]);

  function openModal() {
    const total = value ?? 0;
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;

    setHours(Math.min(h, 5));
    setMinutes(m);
    setSeconds(s);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  function applySelection() {
    const total = hours * 3600 + minutes * 60 + seconds;
    const selectedSeconds = total > 0 ? total : null;
    setDisplay(formatDurationInput(total));
    onChange(selectedSeconds);
    setModalOpen(false);

    if (onBlur) {
      onBlur(selectedSeconds);
    }
  }

  const hourOptions = Array.from({ length: 6 }, (_, i) => i);
  const minuteOptions = Array.from({ length: 60 }, (_, i) => i);

  return (
    <>
      <input
        type="text"
        placeholder="00:00"
        value={display}
        readOnly
        onClick={openModal}
        onFocus={openModal}
        className="border rounded px-2 py-1 w-24 cursor-pointer"
      />

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />

          <div className="relative bg-white rounded-lg p-4 w-80 max-w-full">
            <h3 className="text-lg font-medium mb-3">Seleccionar duración</h3>

            <div className="flex items-end gap-2 mb-4">
              <div className="flex flex-col items-center">
                <label className="text-xs text-gray-600">Horas</label>
                <select
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                  className="border rounded p-1"
                  aria-label="Horas"
                >
                  {hourOptions.map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col items-center">
                <label className="text-xs text-gray-600">Min</label>
                <select
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                  className="border rounded p-1"
                  aria-label="Minutos"
                >
                  {minuteOptions.map((m) => (
                    <option key={m} value={m}>
                      {String(m).padStart(2, "0")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col items-center">
                <label className="text-xs text-gray-600">Seg</label>
                <select
                  value={seconds}
                  onChange={(e) => setSeconds(Number(e.target.value))}
                  className="border rounded p-1"
                  aria-label="Segundos"
                >
                  {minuteOptions.map((s) => (
                    <option key={s} value={s}>
                      {String(s).padStart(2, "0")}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="px-3 py-1 rounded border"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={applySelection}
                className="px-3 py-1 rounded bg-blue-600 text-white"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
