import { PDFParse } from "pdf-parse";

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
