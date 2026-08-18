import Link from "next/link";
import { PawPrint } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

export function ClientPetPills({
  pets,
}: {
  pets: ReadonlyArray<{ _id: Id<"pets">; name: string; breed?: string }>;
}) {
  if (pets.length === 0) {
    return (
      <span className="text-sm italic text-zinc-400 dark:text-zinc-500">
        No pets yet
      </span>
    );
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {pets.map((pet) => {
        const breed = pet.breed?.trim();
        return (
          <li key={pet._id}>
            <Link
              href={`/pets/${pet._id}`}
              onClick={(event) => event.stopPropagation()}
              className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-[#00273c] transition-colors hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-900/50"
            >
              <PawPrint
                size={12}
                className="text-sky-600 dark:text-sky-300"
                aria-hidden
              />
              <span className="truncate">
                {pet.name}
                {breed ? ` • ${breed}` : ""}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
