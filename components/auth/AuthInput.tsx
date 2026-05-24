"use client";

import { useState, type HTMLAttributes } from "react";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";

/**
 * Labeled input used by all auth pages. Optional leading icon and built-in
 * password visibility toggle. The label is rendered in uppercase letter-spacing
 * to match the "Precision Groom" design.
 *
 * `trailingSlot` lets the password field render a "Forgot password?" link to
 * the right of the label without each page having to re-implement that
 * specific layout.
 */
export function AuthInput({
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
  icon: Icon,
  trailingSlot,
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
  icon?: LucideIcon;
  trailingSlot?: React.ReactNode;
}) {
  const [reveal, setReveal] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && reveal ? "text" : type;
  const hasIcon = Boolean(Icon);

  const inputClassName = [
    "w-full rounded-lg border bg-white py-3 text-sm text-zinc-900 outline-none transition-colors",
    hasIcon ? "pl-10" : "pl-3",
    isPassword ? "pr-11" : "pr-3",
    readOnly
      ? "cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400"
      : "border-zinc-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-orange-900",
  ].join(" ");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {label}
        </label>
        {trailingSlot}
      </div>
      <div className="relative">
        {Icon && (
          <Icon
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
            aria-hidden
          />
        )}
        <input
          type={inputType}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          inputMode={inputMode}
          placeholder={placeholder}
          readOnly={readOnly}
          className={inputClassName}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((value) => !value)}
            aria-label={reveal ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
