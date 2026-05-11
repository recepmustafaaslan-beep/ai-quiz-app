import { extractPdfTextWithPdfJs } from "@/lib/server/extractPdfTextPdfJs";
import { getPdfJsServerAssetFields, PDFJS_PDF_PARSE_PEER_VERSION } from "@/lib/server/pdfJsServerAssets";
import { pdfBufferToUint8Array } from "@/lib/server/pdfBufferUint8";

/**
 * Sunucuda PDF ikilisinden düz metin çıkarır (önce pdf-parse v2, boş/hata durumunda pdfjs yedeği).
 * `pdf-parse` yalnızca çağrı anında yüklenir — Vercel’de route modülü yüklenirken çökme riski azalır.
 */
export async function extractPdfTextWithPdfParse(buffer: Buffer): Promise<string> {
  let fromParse = "";
  try {
    const { PDFParse } = await import("pdf-parse");
    const data = pdfBufferToUint8Array(buffer);
    const parser = new PDFParse({
      data,
      ...getPdfJsServerAssetFields(PDFJS_PDF_PARSE_PEER_VERSION, { disableFontFace: false }),
    });
    try {
      const result = await parser.getText();
      fromParse = (result.text ?? "").trim();
      if (
        fromParse.length === 0 &&
        Array.isArray(result.pages) &&
        result.pages.length > 0
      ) {
        fromParse = result.pages
          .map((p: { text?: string }) => (typeof p.text === "string" ? p.text : ""))
          .join("\n\n")
          .trim();
      }
    } finally {
      try {
        await parser.destroy();
      } catch (destroyErr) {
        console.warn("[pdfParseExtract] parser.destroy failed", destroyErr);
      }
    }
  } catch (e) {
    console.warn("[pdfParseExtract] PDFParse failed, will try pdfjs", e);
  }

  if (fromParse.length > 0) {
    return fromParse;
  }

  try {
    return (await extractPdfTextWithPdfJs(buffer)).trim();
  } catch (e) {
    console.error("[pdfParseExtract] pdfjs fallback failed", e);
    return "";
  }
}
