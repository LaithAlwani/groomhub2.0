import { PawPrint } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";

export function ClientPetPills({
  pets,
}: {
  pets: ReadonlyArray<Doc<"pets">>;
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
          <li
            key={pet._id}
            className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-[#00273c] dark:bg-sky-950/40 dark:text-sky-200"
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
          </li>
        );
      })}
    </ul>
  );
}
