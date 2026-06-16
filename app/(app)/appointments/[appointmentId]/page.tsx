import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { AppointmentDetailBody } from "@/components/calendar/AppointmentDetailBody";

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding/create-shop");
  const { appointmentId } = await params;

  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-10">
      <AppointmentDetailBody
        appointmentId={appointmentId as Id<"appointments">}
      />
    </section>
  );
}
