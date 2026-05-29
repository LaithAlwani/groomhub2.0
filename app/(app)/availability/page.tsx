import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { MyAvailabilityBody } from "./MyAvailabilityBody";

export default async function MyAvailabilityPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding/create-shop");

  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        My availability
      </h1>
      <div className="mt-6">
        <MyAvailabilityBody />
      </div>
    </section>
  );
}
