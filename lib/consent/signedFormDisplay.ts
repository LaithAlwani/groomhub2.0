/** Display helpers for signed-consent lists. */

export function formatSignedDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Build a friendly download filename from the template + signer names. */
export function signedPdfFileName(
  templateName: string,
  signerName: string,
): string {
  const slug = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "consent";
  return `${slug(templateName)}-${slug(signerName)}.pdf`;
}
