import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { MyAvailabilityBody } from "./MyAvailabilityBody";

export default async function MyAvailabilityPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding/create-shop");

  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        My availability
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Set the hours you work each week, then override individual days for time
        off or extra shifts.
      </p>
      <div className="mt-8">
        <MyAvailabilityBody />
      </div>
    </section>
  );
}
