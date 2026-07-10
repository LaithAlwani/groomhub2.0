"use client";

import { Mail, Phone } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  formatPhone,
  normalizePhoneEntries,
  PHONE_LABEL_TEXT,
} from "@/lib/phone";

const pillClass =
  "inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-950";

/**
 * The contact chips under the client header: primary phone, any alternate
 * phones (each with its optional mobile / home / work label), and email.
 */
export function ClientContactPills({ client }: { client: Doc<"clients"> }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {client.phone && (
        <span className={`${pillClass} text-zinc-700 dark:text-zinc-300`}>
          <Phone size={12} className="text-zinc-400" aria-hidden />
          {formatPhone(client.phone)}
          {client.phoneLabel && <Label text={PHONE_LABEL_TEXT[client.phoneLabel]} />}
        </span>
      )}
      {normalizePhoneEntries(client.altPhones).map((alt, index) => (
        <span
          key={`${alt.number}-${index}`}
          className={`${pillClass} text-zinc-500 dark:text-zinc-400`}
        >
          <Phone size={12} className="text-zinc-400" aria-hidden />
          {formatPhone(alt.number)}
          {alt.label && <Label text={PHONE_LABEL_TEXT[alt.label]} />}
        </span>
      ))}
      {client.email && (
        <span className={`${pillClass} text-zinc-700 dark:text-zinc-300`}>
          <Mail size={12} className="text-zinc-400" aria-hidden />
          {client.email}
        </span>
      )}
    </div>
  );
}

function Label({ text }: { text: string }) {
  return <span className="text-zinc-400 dark:text-zinc-500">· {text}</span>;
}
