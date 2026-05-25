import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Scheduled jobs.
 *
 * Convex picks up the export named `crons` and runs each registered job on
 * the named schedule. See https://docs.convex.dev/scheduling/cron-jobs.
 */
const crons = cronJobs();

// Daily — hard-delete soft-archived orgs whose 30-day grace has elapsed.
// `sweepDeletedOrgs` reads up to 50 orgs per run; tiny salons, plenty of
// headroom. Time of day is UTC; picking 04:00 UTC = quiet hours in most
// North American time zones.
crons.daily(
  "cleanup-deleted-orgs",
  { hourUTC: 4, minuteUTC: 0 },
  internal.orgCleanup.sweepDeletedOrgs,
);

export default crons;
