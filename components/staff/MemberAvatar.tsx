"use client";

import Image from "next/image";
import type { Doc } from "@/convex/_generated/dataModel";

/**
 * Circular member avatar with a deterministic initials fallback when the
 * `avatarUrl` is missing. Sizing is fixed at 40px to match the new team
 * page design's row height.
 */
export function MemberAvatar({ user }: { user: Doc<"users"> }) {
  if (user.avatarUrl) {
    return (
      <Image
        src={user.avatarUrl}
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 shrink-0 rounded-full border border-zinc-200 object-cover dark:border-zinc-800"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400"
    >
      {initialsOf(user)}
    </span>
  );
}

function initialsOf(user: Doc<"users">): string {
  const first = user.firstName?.trim() ?? "";
  const last = user.lastName?.trim() ?? "";
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first[0].toUpperCase();
  if (user.email) return user.email[0].toUpperCase();
  return "?";
}
