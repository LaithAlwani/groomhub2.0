// Convex auth configuration — verified against the Clerk-issued JWT.
// CLERK_JWT_ISSUER_DOMAIN is set in the Convex deployment env:
//   npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-frontend-api>.clerk.accounts.dev
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
