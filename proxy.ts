import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

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

export default clerkMiddleware(async (auth, req) => {
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
