"use client";

import { useState } from "react";

import {
  formatDurationInput,
  parseDurationInput,
} from "@/lib/formatter";

type Props = {
  value?: number | null;
  onChange: (seconds: number | null) => void;
  onBlur?: () => void;
};

export default function DurationInput({
  value,
  onChange,
  onBlur,
}: Props) {
  const [display, setDisplay] = useState(formatDurationInput(value));

  return (
    <input
      type="text"
      placeholder="00:00"
      value={display}
      onBlur={onBlur}
      onChange={(e) => {
        const raw = e.target.value;

        setDisplay(raw);

        onChange(parseDurationInput(raw));
      }}
      className="border rounded px-2 py-1 w-24"
    />
  );
}
