"use client";

import { DATE_PRESETS } from "@/lib/date-filter";

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  disabled?: boolean;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  disabled = false,
}: DateRangePickerProps) {
  const presets = [
    { label: "2025 Tax Year", key: "2025" as const },
    { label: "2024 Tax Year", key: "2024" as const },
    { label: "All Time", key: "all" as const },
  ];

  const handlePreset = (key: keyof typeof DATE_PRESETS) => {
    const preset = DATE_PRESETS[key];
    onStartDateChange("startDate" in preset ? preset.startDate : "");
    onEndDateChange("endDate" in preset ? preset.endDate : "");
  };

  const isPresetActive = (key: keyof typeof DATE_PRESETS) => {
    const preset = DATE_PRESETS[key];
    const presetStart = "startDate" in preset ? preset.startDate : "";
    const presetEnd = "endDate" in preset ? preset.endDate : "";
    return startDate === presetStart && endDate === presetEnd;
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
      <div className="flex flex-wrap gap-2">
        {presets.map(({ label, key }) => (
          <button
            key={key}
            type="button"
            onClick={() => handlePreset(key)}
            disabled={disabled}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              isPresetActive(key)
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--background)] text-[var(--muted)] hover:text-[var(--foreground)]"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1">
          <label htmlFor="startDate" className="mb-1 block text-xs text-[var(--muted)]">
            From
          </label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            disabled={disabled}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Start date"
          />
        </div>
        <span className="mt-5 text-[var(--muted)]">-</span>
        <div className="flex-1">
          <label htmlFor="endDate" className="mb-1 block text-xs text-[var(--muted)]">
            To
          </label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            disabled={disabled}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="End date"
          />
        </div>
      </div>
    </div>
  );
}
