import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { resolveHost } from "@/lib/host";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/calendar(.*)",
  "/appointments(.*)",
  "/clients(.*)",
  "/services(.*)",
  "/staff(.*)",
  "/settings(.*)",
  "/account(.*)",
  "/onboarding(.*)",
]);

// Routes that require an active org. `/onboarding/*` deliberately doesn't —
// users land there precisely because they have no active org.
const requiresActiveOrg = createRouteMatcher([
  "/dashboard(.*)",
  "/calendar(.*)",
  "/appointments(.*)",
  "/clients(.*)",
  "/services(.*)",
  "/staff(.*)",
  "/settings(.*)",
  "/account(.*)",
]);

// Everything that belongs on the app host (`app.<root>`): the protected app
// surface plus the auth pages. On the marketing host these all get bounced to
// the app host so authentication only ever happens in one place.
const isAppRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/calendar(.*)",
  "/appointments(.*)",
  "/clients(.*)",
  "/services(.*)",
  "/staff(.*)",
  "/settings(.*)",
  "/account(.*)",
  "/onboarding(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sso-callback(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const resolved = resolveHost(req.headers.get("host"));

  // Marketing host (apex / www): public site only, no Clerk protection. Any
  // app/auth route hit here is forwarded to the app host so login lives in one
  // place.
  if (resolved.kind === "marketing") {
    if (isAppRoute(req)) {
      // Swap only the hostname to the app host, preserving scheme + port so
      // this works both locally (http://app.lvh.me:3000) and in production
      // (https://app.groomhub.ca).
      const url = req.nextUrl.clone();
      url.hostname = `app.${resolved.rootDomain}`;
      return NextResponse.redirect(url);
    }
    return;
  }

  // App host (`app.<root>`): the marketing landing has no home here — send the
  // bare root to the dashboard (Clerk bounces to sign-in if needed). All other
  // paths fall through to the shared protection below.
  if (resolved.kind === "app" && req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Tenant subdomains (`<slug>.<root>`) are handled in Phase 3 — for now they
  // fall through to the shared logic below (and no tenant DNS exists yet).

  // Shared protection: applies to the app host and to the "combined" host used
  // in local dev / preview deploys (where marketing + app share one origin).
  if (!isProtectedRoute(req)) return;

  await auth.protect();

  if (requiresActiveOrg(req)) {
    const { userId, orgId } = await auth();
    if (userId && !orgId) {
      return NextResponse.redirect(new URL("/onboarding/create-shop", req.url));
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
