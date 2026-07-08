"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { PhotoStage } from "@/components/media/PhotoStage";

/**
 * Before/after photo picker for the "Log a service" form, where the record
 * doesn't exist yet. Photos upload to storage immediately; we keep the
 * resulting storage ids in the parent's state and hand them to
 * `serviceRecords.create` on submit. Preview URLs come from `storageImageUrls`.
 */
export function ServiceRecordPhotoStage({
  beforeIds,
  afterIds,
  onChangeBefore,
  onChangeAfter,
}: {
  beforeIds: Id<"_storage">[];
  afterIds: Id<"_storage">[];
  onChangeBefore: (ids: Id<"_storage">[]) => void;
  onChangeAfter: (ids: Id<"_storage">[]) => void;
}) {
  const generateUploadUrl = useMutation(api.appointments.generateImageUploadUrl);
  const deleteOrphan = useMutation(api.pets.deleteOrphanStorage);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const allIds = [...beforeIds, ...afterIds];
  const resolved = useQuery(api.serviceRecords.storageImageUrls, {
    storageIds: allIds,
  });
  const urlOf = new Map(
    (resolved ?? []).map((image) => [image.storageId, image.url]),
  );

  const stages = [
    { name: "before" as const, ids: beforeIds, onChange: onChangeBefore },
    { name: "after" as const, ids: afterIds, onChange: onChangeAfter },
  ];

  return (
    <div className="flex flex-col gap-3">
      {stages.map(({ name, ids, onChange }) => (
        <PhotoStage
          key={name}
          stage={name}
          images={ids.map((storageId) => ({
            storageId,
            url: urlOf.get(storageId) ?? null,
          }))}
          onView={setViewerUrl}
          generateUploadUrl={generateUploadUrl}
          onAdd={(storageId) => {
            onChange([...ids, storageId]);
            return Promise.resolve();
          }}
          onRemove={async (storageId) => {
            // Blob is already in storage (uploaded on pick), so actually
            // delete it — not just drop it from the pending list.
            await deleteOrphan({ storageId });
            onChange(ids.filter((id) => id !== storageId));
          }}
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
