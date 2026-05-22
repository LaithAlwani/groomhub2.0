import { Suspense } from "react";
import { currentUser } from "@clerk/nextjs/server";
import { DeclinedQueueList } from "@/components/dashboard/DeclinedQueueList";
import { PendingApprovalsList } from "@/components/dashboard/PendingApprovalsList";
import { TodayList } from "@/components/dashboard/TodayList";

export default function DashboardPage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-12">
      <Suspense fallback={<DashboardSkeleton />}>
        <WelcomeHeader />
      </Suspense>
      <div className="mt-6 flex flex-col gap-6">
        <PendingApprovalsList />
        <DeclinedQueueList />
        <TodayList />
      </div>
    </section>
  );
}

async function WelcomeHeader() {
  const user = await currentUser();
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "there";
  const email = user?.primaryEmailAddress?.emailAddress;

  return (
    <header>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome, {fullName}</h1>
      {email && (
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{email}</p>
      )}
    </header>
  );
}

function DashboardSkeleton() {
  return (
    <header>
      <div className="h-7 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-2 h-4 w-64 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
    </header>
  );
}
