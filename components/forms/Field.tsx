"use client";

import type { HTMLAttributes } from "react";
import { RequiredMark } from "./RequiredMark";

export function Field({
  label,
  value,
  onChange,
  onBlur,
  error,
  type = "text",
  autoComplete,
  inputMode,
  placeholder,
  readOnly,
  required,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  onBlur?: () => void;
  error?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder?: string;
  readOnly?: boolean;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {label}
        {required && <RequiredMark />}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        readOnly={readOnly}
        className={
          readOnly
            ? "cursor-not-allowed rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
            : "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 transition-colors focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
        }
      />
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      )}
    </label>
  );
}
