import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CalendarPageBody } from "./CalendarPageBody";

export default async function CalendarPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding/create-shop");

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Calendar
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Click an empty slot to book, drag an appointment to reschedule.
      </p>
      <div className="mt-6">
        <CalendarPageBody />
      </div>
    </section>
  );
}
