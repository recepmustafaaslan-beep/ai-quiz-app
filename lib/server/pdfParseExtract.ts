import { PDFParse } from "pdf-parse";

/** İlk baytlar %PDF ise gerçek PDF ikilisi kabul edilir (iOS sık octet-stream gönderir). */
export function bufferHasPdfSignature(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
}

/**
 * Sunucuda PDF ikilisinden düz metin çıkarır (pdf-parse v2).
 *
 * Not: `import pdf from "pdf-parse"` eski v1 kalıbıdır; v2’de yalnızca
 * `{ PDFParse }` named export vardır — `new PDFParse({ data }).getText()`.
 */
export async function extractPdfTextWithPdfParse(buffer: Buffer): Promise<string> {
  const data = new Uint8Array(buffer);
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return (result.text ?? "").trim();
  } finally {
    await parser.destroy();
  }
}
