"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  // Fail fast in the browser — without a URL, every Convex hook silently hangs.
  // eslint-disable-next-line no-console
  console.error(
    "NEXT_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` to provision a deployment.",
  );
}

const convex = new ConvexReactClient(convexUrl ?? "https://placeholder.invalid");

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
