import { extractPdfTextWithPdfJs } from "@/lib/server/extractPdfTextPdfJs";

/**
 * Sunucuda PDF ikilisinden düz metin çıkarır (önce pdf-parse v2, boş/hata durumunda pdfjs yedeği).
 * `pdf-parse` yalnızca çağrı anında yüklenir — Vercel’de route modülü yüklenirken çökme riski azalır.
 */
export async function extractPdfTextWithPdfParse(buffer: Buffer): Promise<string> {
  let fromParse = "";
  try {
    const { PDFParse } = await import("pdf-parse");
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
