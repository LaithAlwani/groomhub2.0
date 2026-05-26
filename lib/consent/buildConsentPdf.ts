import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Assembles a single-page letter-size PDF that captures a signed consent
 * event: header (shop name + signing date), the template body wrapped to
 * the page width, signer name typed line, and the signature image pasted
 * near the bottom.
 *
 * Runs in the browser (pdf-lib supports the browser bundle). The signing
 * dialog calls this right after the user lifts their finger.
 *
 * If the body is long enough to overflow one page, additional pages are
 * appended automatically before the signature block.
 */
export async function buildConsentPdf(input: {
  shopName: string;
  templateName: string;
  templateBody: string;
  signerName: string;
  signedAt: Date;
  signaturePngBytes: Uint8Array;
}): Promise<Uint8Array> {
  const PAGE_WIDTH = 612;
  const PAGE_HEIGHT = 792;
  const MARGIN = 54;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
  // Reserved at the bottom of the last page: signature image sits above the
  // line, printed name + date underneath — typical signature-block layout
  // so there's no big gap between the squiggle and the name.
  const SIGNATURE_BLOCK_HEIGHT = 110;

  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const signatureImage = await doc.embedPng(input.signaturePngBytes);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - MARGIN;

  // Header — shop name big, date underneath.
  page.drawText(input.shopName, {
    x: MARGIN,
    y: cursorY - 14,
    size: 18,
    font: fontBold,
    color: rgb(0, 0.153, 0.235), // matches the app's dark navy accent
  });
  cursorY -= 28;
  page.drawText(`Signed ${formatDate(input.signedAt)}`, {
    x: MARGIN,
    y: cursorY - 12,
    size: 10,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  });
  cursorY -= 36;

  // Template name as a sub-heading.
  page.drawText(input.templateName, {
    x: MARGIN,
    y: cursorY - 14,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  cursorY -= 28;

  // Body — wrap each paragraph, blank lines separate paragraphs.
  const bodySize = 11;
  const lineHeight = 15;
  const paragraphs = input.templateBody.split(/\n\s*\n/);
  for (const paragraph of paragraphs) {
    const flat = paragraph.replace(/\s+/g, " ").trim();
    if (flat.length === 0) continue;
    const lines = wrapText(flat, fontRegular, bodySize, CONTENT_WIDTH);
    for (const line of lines) {
      if (cursorY - lineHeight < MARGIN + SIGNATURE_BLOCK_HEIGHT) {
        page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        cursorY = PAGE_HEIGHT - MARGIN;
      }
      page.drawText(line, {
        x: MARGIN,
        y: cursorY - bodySize,
        size: bodySize,
        font: fontRegular,
        color: rgb(0.15, 0.15, 0.15),
      });
      cursorY -= lineHeight;
    }
    cursorY -= 8; // paragraph spacer
  }

  // Make sure there's room for the signature block on the current page,
  // otherwise jump to a new one.
  if (cursorY - SIGNATURE_BLOCK_HEIGHT < MARGIN) {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    cursorY = PAGE_HEIGHT - MARGIN;
  }

  // Signature block laid out top-to-bottom:
  //   1. Signature image (sits above the line, left-aligned)
  //   2. Horizontal divider — the "signature line" the squiggle rests on
  //   3. "Signed by Jane Doe" + signing date directly underneath, no gap
  const NAME_BASELINE_Y = MARGIN + 14;
  const DIVIDER_Y = MARGIN + 38;
  const IMAGE_BOTTOM_Y = DIVIDER_Y + 2; // signature sits just above the line

  const signatureMaxWidth = 220;
  const signatureMaxHeight = 60;
  const scale = Math.min(
    signatureMaxWidth / signatureImage.width,
    signatureMaxHeight / signatureImage.height,
    1,
  );
  const drawWidth = signatureImage.width * scale;
  const drawHeight = signatureImage.height * scale;

  page.drawImage(signatureImage, {
    x: MARGIN,
    y: IMAGE_BOTTOM_Y,
    width: drawWidth,
    height: drawHeight,
  });

  page.drawLine({
    start: { x: MARGIN, y: DIVIDER_Y },
    end: { x: PAGE_WIDTH - MARGIN, y: DIVIDER_Y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });

  page.drawText(input.signerName, {
    x: MARGIN,
    y: NAME_BASELINE_Y,
    size: 12,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  // Right-align the date by measuring it.
  const dateText = formatDate(input.signedAt);
  const dateWidth = fontRegular.widthOfTextAtSize(dateText, 11);
  page.drawText(dateText, {
    x: PAGE_WIDTH - MARGIN - dateWidth,
    y: NAME_BASELINE_Y,
    size: 11,
    font: fontRegular,
    color: rgb(0.3, 0.3, 0.3),
  });

  return await doc.save();
}

/**
 * Greedy line-break: take words one at a time and start a new line as soon
 * as the next word would overflow the available width. `font.widthOfTextAtSize`
 * is the canonical pdf-lib measurement helper.
 */
function wrapText(
  text: string,
  font: { widthOfTextAtSize: (text: string, size: number) => number },
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth) {
      if (current.length > 0) lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
