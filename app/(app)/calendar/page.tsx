import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CalendarPageBody } from "./CalendarPageBody";

export default async function CalendarPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding/create-shop");

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-8 md:py-10">
      <CalendarPageBody />
    </section>
  );
}
