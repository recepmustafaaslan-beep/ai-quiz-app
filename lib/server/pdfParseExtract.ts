import { PDFParse } from "pdf-parse";
import { extractPdfTextWithPdfJs } from "@/lib/server/extractPdfTextPdfJs";

/** İlk baytlar %PDF ise gerçek PDF ikilisi kabul edilir (iOS sık octet-stream gönderir). */
export function bufferHasPdfSignature(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
}

/**
 * Sunucuda PDF ikilisinden düz metin çıkarır (önce pdf-parse v2, boş/hata durumunda pdfjs yedeği).
 */
export async function extractPdfTextWithPdfParse(buffer: Buffer): Promise<string> {
  let fromParse = "";
  try {
    const data = new Uint8Array(buffer);
    const parser = new PDFParse({ data });
    try {
      const result = await parser.getText();
      fromParse = (result.text ?? "").trim();
    } finally {
      await parser.destroy();
    }
  } catch (e) {
    console.warn("[pdfParseExtract] PDFParse failed, will try pdfjs", e);
  }

  if (fromParse.length > 0) {
    return fromParse;
  }

  const fromJs = await extractPdfTextWithPdfJs(buffer);
  return fromJs.trim();
}
