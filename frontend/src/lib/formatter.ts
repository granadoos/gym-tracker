export function formatDuration(
  seconds?: number | null
): string {
  if (seconds == null || isNaN(seconds)) {
    return "";
  }

  if (seconds <= 0) {
    return "0s";
  }

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (mins === 0) {
    return `${secs}s`;
  }

  if (secs === 0) {
    return `${mins}m`;
  }

  return `${mins}m ${secs}s`;
}

export function formatDurationInput(
  totalSeconds?: number | null
): string {
  if (totalSeconds == null || totalSeconds <= 0) {
    return "";
  }

  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function parseDurationInput(
  value: string
): number | null {
  if (!value) return null;

  const parts = value.split(":").map((p) => p.trim());

  if (parts.length === 2) {
    const mins = Number(parts[0]);
    const secs = Number(parts[1]);

    if (isNaN(mins) || isNaN(secs)) return null;

    return mins * 60 + secs;
  }

  if (parts.length === 3) {
    const hours = Number(parts[0]);
    const mins = Number(parts[1]);
    const secs = Number(parts[2]);

    if (isNaN(hours) || isNaN(mins) || isNaN(secs)) return null;

    return hours * 3600 + mins * 60 + secs;
  }

  return null;
}