"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ServiceList } from "@/components/services/ServiceList";
import { ServiceFormDialog } from "@/components/services/ServiceFormDialog";

export function ServicesPageBody({ canEdit }: { canEdit: boolean }) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="mt-8 flex flex-col gap-4">
      {canEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Plus size={14} />
            New service
          </button>
        </div>
      )}
      <ServiceList />
      {creating && (
        <ServiceFormDialog serviceId="new" onClose={() => setCreating(false)} />
      )}
    </div>
  );
}
