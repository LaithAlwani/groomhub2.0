"use client";

import { Check, Plus } from "lucide-react";

export type SwitcherMembership = {
  id: string;
  name: string;
  role: string;
};

export function SwitcherMenu({
  memberships,
  currentId,
  onSelect,
  onCreate,
}: {
  memberships: ReadonlyArray<SwitcherMembership>;
  currentId: string;
  onSelect: (orgId: string) => void;
  onCreate: () => void;
}) {
  return (
    <div
      role="menu"
      className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
    >
      <ul className="max-h-72 overflow-y-auto py-1">
        {memberships.map((target) => {
          const isCurrent = target.id === currentId;
          return (
            <li key={target.id}>
              <button
                type="button"
                role="menuitem"
                onClick={() => onSelect(target.id)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-zinc-800 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                <span className="flex flex-col">
                  <span className="truncate font-medium">{target.name}</span>
                  <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {target.role.replace("org:", "")}
                  </span>
                </span>
                {isCurrent && (
                  <Check size={16} className="text-emerald-600 dark:text-emerald-400" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          role="menuitem"
          onClick={onCreate}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          <Plus size={16} />
          Create new shop
        </button>
      </div>
    </div>
  );
}

