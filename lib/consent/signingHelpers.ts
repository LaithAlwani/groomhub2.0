/**
 * Pure helpers for the consent signing flow, factored out of
 * `SignConsentDialog` to keep that component focused on UI.
 */

/**
 * Decode a `data:image/png;base64,…` URL straight to a `Uint8Array` without
 * going through `fetch()`. Avoids two failure modes: strict CSPs that block
 * `data:` URL fetches, and "Failed to fetch" TypeErrors in some browsers.
 */
export function decodeDataUrlToBytes(dataUrl: string): Uint8Array {
  const commaAt = dataUrl.indexOf(",");
  if (commaAt < 0) throw new Error("Invalid data URL");
  const payload = dataUrl.slice(commaAt + 1);
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** POST a blob to a Convex upload URL and return the resulting storage id. */
export async function uploadToStorage(
  uploadUrl: string,
  blob: Blob,
  contentType: string,
): Promise<string> {
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!response.ok) throw new Error("Upload failed");
  const { storageId } = (await response.json()) as { storageId: string };
  return storageId;
}
