import type { Doc } from "@/convex/_generated/dataModel";

/**
 * Two-letter initial avatar used in both the desktop clients table and the
 * mobile cards. Pulls the first letter of the first word + first letter of
 * the last word in `fullName`, falling back to the first character.
 */
export function ClientRowAvatar({
  client,
  size = "md",
}: {
  client: Doc<"clients">;
  size?: "sm" | "md" | "lg";
}) {
  const initials = initialsFor(client.fullName);
  const sizeClassName =
    size === "lg" ? "h-12 w-12 text-base" : size === "sm" ? "h-9 w-9 text-xs" : "h-10 w-10 text-sm";
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-sky-50 font-semibold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 ${sizeClassName}`}
    >
      {initials}
    </span>
  );
}

function initialsFor(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  const first = parts[0]![0] ?? "";
  const last = parts[parts.length - 1]![0] ?? "";
  return `${first}${last}`.toUpperCase();
}
