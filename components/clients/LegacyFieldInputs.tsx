"use client";

/**
 * Shared field inputs for the legacy-appointment edit form. `NameSelect`
 * backs the Pet / Service dropdowns; `TextField` backs the free-text fields.
 */
export const inputClass =
  "rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:border-[#00273c] focus:outline-none focus:ring-2 focus:ring-[#00273c]/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";
export const labelClass =
  "text-[10px] font-semibold uppercase tracking-wide text-zinc-400";

export function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={labelClass}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
    </label>
  );
}

/**
 * A `<select>` over known names (pets / services). Keeps the current value
 * selectable even when it isn't among the options — imported rows often name
 * a pet or service that no longer exists as a record, and we don't want
 * editing an unrelated field to silently drop it.
 */
export function NameSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const hasValue = value.trim().length > 0;
  const isKnown = options.includes(value);
  return (
    <label className="flex flex-col gap-1">
      <span className={labelClass}>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      >
        <option value="">— None —</option>
        {hasValue && !isKnown && (
          <option value={value}>{value} (imported)</option>
        )}
        {options.map((name, index) => (
          <option key={`${name}-${index}`} value={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
