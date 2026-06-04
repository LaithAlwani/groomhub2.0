"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

type Invoice = {
  id: string;
  number: string | null;
  amountPaid: number;
  currency: string;
  status: string | null;
  created: number;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
};

export function InvoiceList({ hasSubscription }: { hasSubscription: boolean }) {
  const listInvoices = useAction(api.stripe.listInvoices);
  // `null` = still fetching; `[]` = fetched, none yet. Derive `loading` from
  // these so we don't have to synchronously toggle state inside the effect.
  const [invoices, setInvoices] = useState<Invoice[] | null>(
    hasSubscription ? null : [],
  );

  useEffect(() => {
    if (!hasSubscription) return;
    let cancelled = false;
    listInvoices({})
      .then((result) => {
        if (!cancelled) setInvoices(result);
      })
      .catch(() => {
        if (!cancelled) setInvoices([]);
      });
    return () => {
      cancelled = true;
    };
  }, [hasSubscription, listInvoices]);

  const loading = invoices === null;
  const rows = invoices ?? [];

  return (
    <section>
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        Billing history
      </h2>
      <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        {loading ? (
          <div className="px-5 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No invoices yet. Your first invoice will appear here after your first
            billing cycle.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map((invoice) => (
              <InvoiceRow key={invoice.id} invoice={invoice} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const dateLabel = new Date(invoice.created).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const amount = formatAmount(invoice.amountPaid, invoice.currency);
  return (
    <li className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {invoice.number ?? invoice.id}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{dateLabel}</p>
      </div>
      <div className="flex items-center gap-3 sm:gap-5">
        <span className="text-sm text-zinc-700 dark:text-zinc-200">{amount}</span>
        <StatusBadge status={invoice.status} />
        {invoice.invoicePdf && (
          <a
            href={invoice.invoicePdf}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            <Download size={12} />
            PDF
          </a>
        )}
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  const tone =
    status === "paid"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : status === "open" || status === "draft"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}

function formatAmount(amountCents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}
