"use client";

/**
 * Accessible on/off switch styled to match the app's orange CTA palette.
 * Renders as a `<button role="switch">` so screen readers + keyboard users
 * get the right semantics. Pair with an external label using the
 * `<SwitchRow>` helper for the standard "label on the left, switch on the
 * right" layout used in the pet form's Status section.
 */
export function Switch({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        checked
          ? "bg-orange-500"
          : "bg-zinc-300 dark:bg-zinc-700"
      }`}
    >
      <span
        aria-hidden
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

/**
 * Row layout for one toggle: title + optional helper text on the left,
 * the switch flush to the right. Click on the label area also flips the
 * switch (matches native `<label>`/checkbox behaviour).
 */
export function SwitchRow({
  title,
  helper,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  helper?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      onClick={() => !disabled && onChange(!checked)}
      className={`flex items-center justify-between gap-3 ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {title}
        </p>
        {helper && (
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {helper}
          </p>
        )}
      </div>
      <Switch
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        ariaLabel={title}
      />
    </div>
  );
}
