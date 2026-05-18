"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { api } from "@/convex/_generated/api";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  // Fail fast in the browser — without a URL, every Convex hook silently hangs.
  // eslint-disable-next-line no-console
  console.error(
    "NEXT_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` to provision a deployment.",
  );
}

const convex = new ConvexReactClient(convexUrl ?? "https://placeholder.invalid");

// Dev-only escape hatch: expose the client + api map on `window` so you can
// poke at queries/mutations from the browser console. Stripped from production
// bundles via the NODE_ENV check.
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  const devGlobals = window as unknown as {
    __convex?: ConvexReactClient;
    __convexApi?: typeof api;
  };
  devGlobals.__convex = convex;
  devGlobals.__convexApi = api;
}

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
