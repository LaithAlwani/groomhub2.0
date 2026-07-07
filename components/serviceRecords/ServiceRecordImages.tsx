"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { PhotoStage, type PhotoImage } from "@/components/media/PhotoStage";

/**
 * Editable before/after photos for a service record. Wires the shared
 * `PhotoStage` to the service-record image mutations (upload URL is reused
 * from the appointments module — it's reference-free).
 */
export function ServiceRecordImages({
  recordId,
  before,
  after,
}: {
  recordId: Id<"serviceRecords">;
  before: PhotoImage[];
  after: PhotoImage[];
}) {
  const generateUploadUrl = useMutation(api.appointments.generateImageUploadUrl);
  const addImage = useMutation(api.serviceRecords.addImage);
  const removeImage = useMutation(api.serviceRecords.removeImage);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {(["before", "after"] as const).map((stage) => (
        <PhotoStage
          key={stage}
          stage={stage}
          images={stage === "before" ? before : after}
          onView={setViewerUrl}
          generateUploadUrl={generateUploadUrl}
          onAdd={(storageId) => addImage({ id: recordId, stage, storageId })}
          onRemove={(storageId) =>
            removeImage({ id: recordId, stage, storageId })
          }
        />
      ))}
      {viewerUrl && (
        <ImageLightbox
          url={viewerUrl}
          alt="Service photo"
          onClose={() => setViewerUrl(null)}
        />
      )}
    </div>
  );
}
