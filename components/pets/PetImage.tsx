"use client";

import { PawPrint } from "lucide-react";

type Size = "sm" | "md" | "lg";

const DIMENSIONS: Record<Size, { px: number; icon: number }> = {
  sm: { px: 40, icon: 18 },
  md: { px: 56, icon: 22 },
  lg: { px: 96, icon: 36 },
};

export function PetImage({
  imageUrl,
  alt,
  size = "md",
}: {
  imageUrl: string | null | undefined;
  alt: string;
  size?: Size;
}) {
  const dims = DIMENSIONS[size];
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={alt}
        width={dims.px}
        height={dims.px}
        loading="lazy"
        className="shrink-0 rounded-full border border-zinc-200 object-cover dark:border-zinc-800"
        style={{ width: dims.px, height: dims.px }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300"
      style={{ width: dims.px, height: dims.px }}
    >
      <PawPrint size={dims.icon} />
    </span>
  );
}
