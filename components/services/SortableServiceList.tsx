"use client";

import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { ServiceRow } from "./ServiceRow";

type RowCallbacks = {
  overrideByServiceId: Map<Id<"services">, Doc<"serviceLocationOverrides">>;
  currentLocation: Doc<"locations"> | null;
  multiLocation: boolean;
  canEdit: boolean;
  canManage: boolean;
  busyId: Id<"services"> | null;
  onEdit: (id: Id<"services">) => void;
  onArchive: (service: Doc<"services">) => void;
  onCustomize: (id: Id<"services">) => void;
};

/**
 * The services catalog list with drag-to-reorder (staff+). Wraps the rows in a
 * dnd-kit sortable context; dragging the grip handle reorders with animation
 * and persists via `services.reorder`. An optimistic local order keeps the row
 * in place while the mutation round-trips.
 */
export function SortableServiceList({
  services,
  ...callbacks
}: { services: Doc<"services">[] } & RowCallbacks) {
  const reorder = useMutation(api.services.reorder);
  const [order, setOrder] = useState<Id<"services">[] | null>(null);

  const ordered = useMemo(() => {
    if (!order) return services;
    const rank = new Map(order.map((id, index) => [id, index] as const));
    return [...services].sort((a, b) => {
      const rankA = rank.get(a._id) ?? Number.POSITIVE_INFINITY;
      const rankB = rank.get(b._id) ?? Number.POSITIVE_INFINITY;
      return rankA === rankB ? 0 : rankA - rankB;
    });
  }, [services, order]);

  const sensors = useSensors(
    // 5px activation distance so a tap that edits/archives a row isn't a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = ordered.map((service) => service._id);
    const oldIndex = ids.indexOf(active.id as Id<"services">);
    const newIndex = ids.indexOf(over.id as Id<"services">);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(ids, oldIndex, newIndex);
    setOrder(next);
    void reorder({ orderedIds: next });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={ordered.map((service) => service._id)}
        strategy={verticalListSortingStrategy}
      >
        <ul>
          {ordered.map((service) => (
            <SortableServiceRow
              key={service._id}
              service={service}
              {...callbacks}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableServiceRow({
  service,
  ...callbacks
}: { service: Doc<"services"> } & RowCallbacks) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: service._id });

  const handle = callbacks.canEdit ? (
    <button
      type="button"
      {...attributes}
      {...listeners}
      onClick={(event) => event.stopPropagation()}
      aria-label="Drag to reorder"
      className="cursor-grab touch-none rounded-lg p-1.5 text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-500 active:cursor-grabbing disabled:opacity-50 dark:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
    >
      <GripVertical size={14} />
    </button>
  ) : null;

  return (
    <ServiceRow
      service={service}
      override={callbacks.overrideByServiceId.get(service._id) ?? null}
      currentLocation={callbacks.currentLocation}
      multiLocation={callbacks.multiLocation}
      canEdit={callbacks.canEdit}
      canManage={callbacks.canManage}
      isBusy={callbacks.busyId === service._id}
      onEdit={() => callbacks.onEdit(service._id)}
      onArchive={() => callbacks.onArchive(service)}
      onCustomizeForLocation={() => callbacks.onCustomize(service._id)}
      dragRef={setNodeRef}
      dragStyle={{ transform: CSS.Transform.toString(transform), transition }}
      dragHandle={handle}
      isDragging={isDragging}
    />
  );
}
