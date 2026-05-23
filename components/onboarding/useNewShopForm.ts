"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { z } from "zod";
import { resolveBrowserTimezone } from "@/lib/timezones";

export const SUPPORTED_CURRENCIES = ["CAD", "USD", "EUR", "GBP", "AUD"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const newShopSchema = z.object({
  name: z.string().trim().min(2, "Shop name is required"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Slug must be at least 3 characters")
    .max(40, "Slug must be at most 40 characters")
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/, "Letters, numbers and dashes only"),
  timezone: z.string().min(1),
  currency: z.enum(SUPPORTED_CURRENCIES),
  shopEmail: z
    .string()
    .trim()
    .email("Enter a valid email")
    .max(254, "Email is too long"),
});

export type NewShopFormInput = z.infer<typeof newShopSchema>;
export type NewShopFieldErrors = Partial<Record<keyof NewShopFormInput, string>>;

/**
 * Form-state hook for `NewShopForm`. Owns the text fields, the slug-from-name
 * auto-derivation, the picked-but-not-yet-uploaded logo file, and the user's
 * primary email as the prefilled shop email. Kept in a sibling file so the
 * form component itself stays under the 200-line cap.
 */
export function useNewShopForm() {
  const { user } = useUser();
  // Pre-pick the user's local timezone if it's one we offer; otherwise default
  // to Eastern (Toronto) since this is a Canada-first product. The user can
  // change it before submitting.
  const browserTimezone = useMemo(
    () => resolveBrowserTimezone("America/Toronto"),
    [],
  );

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [timezone, setTimezone] = useState(browserTimezone);
  const [currency, setCurrency] = useState<Currency>("CAD");
  const [shopEmail, setShopEmail] = useState("");
  const [shopEmailTouched, setShopEmailTouched] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Prefill shop email with the Clerk user's primary email when it arrives —
  // unless the user has already typed something themselves.
  useEffect(() => {
    if (shopEmailTouched) return;
    const userEmail = user?.primaryEmailAddress?.emailAddress;
    if (userEmail && shopEmail === "") setShopEmail(userEmail);
  }, [user, shopEmail, shopEmailTouched]);

  // Derive a slug from the shop name while the user hasn't manually edited it.
  useEffect(() => {
    if (slugTouched) return;
    const suggestion = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    setSlug(suggestion);
  }, [name, slugTouched]);

  return {
    name,
    setName,
    slug,
    setSlug: (next: string) => {
      setSlugTouched(true);
      setSlug(next);
    },
    timezone,
    setTimezone,
    currency,
    setCurrency,
    shopEmail,
    setShopEmail: (next: string) => {
      setShopEmailTouched(true);
      setShopEmail(next);
    },
    logoFile,
    setLogoFile,
  };
}
