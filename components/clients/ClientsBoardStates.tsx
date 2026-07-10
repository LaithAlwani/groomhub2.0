/** Loading + empty states for the clients board. */

export function BoardSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-4">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900"
          />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ search }: { search: string }) {
  return (
    <p className="rounded-xl border border-zinc-200 bg-white px-4 py-12 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
      {search
        ? `No clients match “${search}”.`
        : "No clients yet. Add your first one to get started."}
    </p>
  );
}
