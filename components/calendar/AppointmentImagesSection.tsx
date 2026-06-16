"use client";

import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import {
  AppointmentImageStage,
  type AppointmentImage,
} from "./AppointmentImageStage";

/**
 * Before/after photo galleries (appointment dialog + detail page). Each stage
 * supports camera capture and library upload; clicking a thumbnail opens it
 * full-size in a lightbox.
 */
export function AppointmentImagesSection({
  appointmentId,
  before,
  after,
}: {
  appointmentId: Id<"appointments">;
  before: AppointmentImage[];
  after: AppointmentImage[];
}) {
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Before &amp; after photos
      </span>
      <AppointmentImageStage
        appointmentId={appointmentId}
        stage="before"
        images={before}
        onView={setViewerUrl}
      />
      <AppointmentImageStage
        appointmentId={appointmentId}
        stage="after"
        images={after}
        onView={setViewerUrl}
      />
      {viewerUrl && (
        <ImageLightbox
          url={viewerUrl}
          alt="Appointment photo"
          onClose={() => setViewerUrl(null)}
        />
      )}
    </div>
  );
}
