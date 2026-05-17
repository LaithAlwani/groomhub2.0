export function SignInProgress({ message }: { message: string }) {
  return (
    <section className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
    </section>
  );
}
