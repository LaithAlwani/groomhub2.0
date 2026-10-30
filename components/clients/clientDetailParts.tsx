import type { Doc } from "@/convex/_generated/dataModel";

/** Presentation helpers for `ClientDetail`, split out to keep that file focused. */

export function hasAddress(client: Doc<"clients">): boolean {
  return Boolean(
    client.addressLine1 ||
      client.addressLine2 ||
      client.city ||
      client.state ||
      client.postalCode ||
      client.country,
  );
}

export function formatAddress(client: Doc<"clients">): string {
  const lines: string[] = [];
  if (client.addressLine1) lines.push(client.addressLine1);
  if (client.addressLine2) lines.push(client.addressLine2);
  const cityState = [client.city, client.state].filter(Boolean).join(", ");
  const cityStateZip = [cityState, client.postalCode]
    .filter((part) => part && part.length > 0)
    .join(" ");
  if (cityStateZip) lines.push(cityStateZip);
  if (client.country) lines.push(client.country);
  return lines.join("\n");
}

export function DetailSkeleton() {
  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="h-32 w-full animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-40 w-full animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}
