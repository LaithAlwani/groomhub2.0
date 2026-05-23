/**
 * Compress an image File to a JPEG Blob suitable for upload. Resizes the
 * longest edge to `maxDim` (default 512px) and re-encodes at JPEG quality
 * `quality` (default 0.85). A typical 4 MB phone photo lands around 50–80 KB
 * after this — fine for a shop logo or any avatar-sized display.
 *
 * Returns the original file untouched if it's already small enough and not a
 * resizable image type — let `<img>` handle SVGs etc as-is.
 */
export async function compressImage(
  file: File,
  options: { maxDim?: number; quality?: number; mimeType?: string } = {},
): Promise<Blob> {
  const maxDim = options.maxDim ?? 512;
  const quality = options.quality ?? 0.85;
  const outputType = options.mimeType ?? "image/jpeg";

  // SVGs, GIFs (animation lost on canvas) and anything non-bitmap — pass through.
  if (!/^image\/(jpeg|jpg|png|webp|heic|heif)$/i.test(file.type)) {
    return file;
  }

  const bitmap = await loadBitmap(file);
  const { width, height } = scaleToFit(bitmap.width, bitmap.height, maxDim);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);

  return await new Promise<Blob>((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ?? file),
      outputType,
      quality,
    );
  });
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to HTMLImageElement path for browsers that choke on the
      // file's mime (e.g. some HEIC variants on desktop Safari).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await loadImageElement(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image"));
    image.src = src;
  });
}

function scaleToFit(
  sourceWidth: number,
  sourceHeight: number,
  maxDim: number,
): { width: number; height: number } {
  if (sourceWidth <= maxDim && sourceHeight <= maxDim) {
    return { width: sourceWidth, height: sourceHeight };
  }
  if (sourceWidth >= sourceHeight) {
    return {
      width: maxDim,
      height: Math.round((sourceHeight / sourceWidth) * maxDim),
    };
  }
  return {
    width: Math.round((sourceWidth / sourceHeight) * maxDim),
    height: maxDim,
  };
}
