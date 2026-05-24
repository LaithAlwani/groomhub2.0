"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Numbered pagination row. Wired client-side over the (bounded) list returned
 * by `clients.listWithPets`. Mirrors the design's "Showing X to Y of Z clients"
 * left-aligned summary + numbered buttons on the right.
 */
export function ClientsPagination({
  page,
  pageSize,
  total,
  onPage,
  trailingSlot,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (next: number) => void;
  trailingSlot?: React.ReactNode;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  // Show up to 5 page chips around the current page.
  const visiblePages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(pageCount, start + 4);
  const actualStart = Math.max(1, end - 4);
  for (let index = actualStart; index <= end; index += 1) {
    visiblePages.push(index);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Showing {from} to {to} of {total} clients
      </p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex items-center gap-2">
          <PageButton
            onClick={() => onPage(page - 1)}
            disabled={page <= 1}
            ariaLabel="Previous page"
          >
            <ChevronLeft size={14} />
          </PageButton>
          {visiblePages.map((number) => (
            <PageChip
              key={number}
              number={number}
              active={number === page}
              onClick={() => onPage(number)}
            />
          ))}
          <PageButton
            onClick={() => onPage(page + 1)}
            disabled={page >= pageCount}
            ariaLabel="Next page"
          >
            <ChevronRight size={14} />
          </PageButton>
        </div>
        {trailingSlot}
      </div>
    </div>
  );
}

function PageChip({
  number,
  active,
  onClick,
}: {
  number: number;
  active: boolean;
  onClick: () => void;
}) {
  const className = active
    ? "h-9 w-9 rounded-lg bg-[#00273c] text-sm font-semibold text-white shadow-sm"
    : "h-9 w-9 rounded-lg border border-zinc-200 bg-white text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900";
  return (
    <button type="button" onClick={onClick} className={className}>
      {number}
    </button>
  );
}

function PageButton({
  children,
  onClick,
  disabled,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
    >
      {children}
    </button>
  );
}
