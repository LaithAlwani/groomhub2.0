"use client";

import { Plus } from "lucide-react";

/** Page title row for the clients board, with the desktop "New client" button. */
export function ClientsBoardHeader({
  canEdit,
  onCreate,
}: {
  canEdit: boolean;
  onCreate: () => void;
}) {
  return (
    <header className="flex flex-col gap-4 min-[874px]:flex-row min-[874px]:items-end min-[874px]:justify-between">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-[#00273c] dark:text-zinc-50">
          Clients
        </h1>
      </div>
      {canEdit && (
        <button
          type="button"
          onClick={onCreate}
          className="hidden items-center gap-2 rounded-lg bg-orange-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 min-[874px]:inline-flex"
        >
          <Plus size={14} />
          New client
        </button>
      )}
    </header>
  );
}
