"use client";

/**
 * Orange-gradient full-width CTA used by every auth form (Sign In, Create
 * Account, Verify, Continue). Keeps the disabled state consistent across
 * pages — disabled fades to a flat zinc fill instead of dimming the gradient,
 * which reads poorly in dark mode.
 */
export function AuthPrimaryButton({
  children,
  disabled,
  type = "submit",
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex w-full items-center justify-center rounded-lg bg-linear-to-b from-orange-500 to-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-none disabled:bg-zinc-200 disabled:text-zinc-500 disabled:shadow-none dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
    >
      {children}
    </button>
  );
}
