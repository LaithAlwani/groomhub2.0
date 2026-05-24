"use client";

import { ChevronDown, Search } from "lucide-react";

export type SortKey = "lastVisit" | "name";

/**
 * Search + dropdowns row above the clients table. Export CSV and New client
 * affordances live on the page header (next to the title), not here, so the
 * toolbar stays focused on filtering.
 */
export function ClientsToolbar({
  search,
  onSearch,
  sort,
  onSort,
}: {
  search: string;
  onSearch: (next: string) => void;
  sort: SortKey;
  onSort: (next: SortKey) => void;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <label className="relative flex-1">
        <Search
          size={16}
          aria-hidden
          className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search by name, phone, or pet…"
          className="w-full rounded-lg border border-zinc-200 bg-white py-2.5 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:ring-orange-900"
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <FakeSelect label="All Memberships" />
        <SortSelect value={sort} onChange={onSort} />
      </div>
    </div>
  );
}

function FakeSelect({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      // TODO: wire membership tiers once we add the data model.
      className="inline-flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 disabled:cursor-not-allowed dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
    >
      {label}
      <ChevronDown size={14} className="text-zinc-400 dark:text-zinc-500" />
    </button>
  );
}

function SortSelect({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (next: SortKey) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
      <span className="text-zinc-500 dark:text-zinc-400">Sort by:</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as SortKey)}
        className="bg-transparent text-sm font-medium text-[#00273c] focus:outline-none dark:text-zinc-50"
      >
        <option value="lastVisit">Last Visit</option>
        <option value="name">Name</option>
      </select>
    </label>
  );
}
