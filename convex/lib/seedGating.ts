/**
 * Gates the new-shop test-data seed to dev Convex deployments only.
 *
 * Convex auto-populates `process.env.CONVEX_CLOUD_URL` inside every
 * function with the deployment's URL (e.g. `https://<slug>.convex.cloud`).
 * Matching against a known dev slug means:
 *   - Any frontend host (groomhub.ca, www.localhost, etc.) that points at
 *     the dev backend will trigger the seed.
 *   - A future prod Convex deployment automatically excludes itself —
 *     its URL won't contain a dev slug.
 *
 * To add a staging or per-developer deployment later, append its slug
 * to `DEV_DEPLOYMENT_SLUGS`.
 */
const DEV_DEPLOYMENT_SLUGS = ["avid-terrier-729"];

export function isDevDeployment(): boolean {
  const cloudUrl = process.env.CONVEX_CLOUD_URL ?? "";
  return DEV_DEPLOYMENT_SLUGS.some((slug) => cloudUrl.includes(slug));
}
