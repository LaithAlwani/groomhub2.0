"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/**
 * Full-screen image viewer. Click the backdrop or the close button (or press
 * Escape) to dismiss. Reusable across appointment photos, signed forms, etc.
 */
export function ImageLightbox({
  url,
  alt = "Image",
  onClose,
}: {
  url: string;
  alt?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onClick={onClose}
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
      >
        <X size={20} />
      </button>
      <img
        src={url}
        alt={alt}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl"
      />
    </div>
  );
}
