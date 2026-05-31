"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { RequiredMark } from "@/components/forms/RequiredMark";

type Tone = "ok" | "error" | "muted";
type Hint = { tone: Tone; text: string };

export function SlugInput({
  slug,
  onChange,
  error,
}: {
  slug: string;
  onChange: (next: string) => void;
  error?: string;
}) {
  const hint = useSlugHint(slug);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Public URL slug
        <RequiredMark />
      </label>
      <div className="flex items-stretch overflow-hidden rounded-lg border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950">
        <span className="px-3 py-2 text-sm text-zinc-400 dark:text-zinc-500">
          groomhub.app/
        </span>
        <input
          value={slug}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
          placeholder="poshpaws"
          className="flex-1 bg-transparent px-1 py-2 text-sm text-zinc-900 focus:outline-none dark:text-zinc-100"
        />
      </div>
      {hint && (
        <span className={toneClass(hint.tone)}>{hint.text}</span>
      )}
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  );
}

function useSlugHint(slug: string): Hint | null {
  const debouncedSlug = useDebouncedValue(slug, 250);
  const queryArgs = debouncedSlug.length >= 3 ? { slug: debouncedSlug } : "skip";
  const availability = useQuery(api.organizations.isSlugAvailable, queryArgs);

  if (slug.length === 0) return null;
  if (slug.length < 3) return { tone: "muted", text: "Keep typing…" };
  if (availability === undefined) return { tone: "muted", text: "Checking availability…" };
  if (availability.ok) return { tone: "ok", text: "Available" };
  if (availability.code === "SLUG_RESERVED") return { tone: "error", text: "Reserved name" };
  if (availability.code === "SLUG_INVALID") {
    return { tone: "error", text: "Use lowercase letters, numbers and dashes" };
  }
  if (availability.code === "SLUG_TAKEN") return { tone: "error", text: "Already taken" };
  return null;
}

function toneClass(tone: Tone): string {
  if (tone === "ok") return "text-xs text-emerald-600 dark:text-emerald-400";
  if (tone === "error") return "text-xs text-red-600 dark:text-red-400";
  return "text-xs text-zinc-500 dark:text-zinc-400";
}
