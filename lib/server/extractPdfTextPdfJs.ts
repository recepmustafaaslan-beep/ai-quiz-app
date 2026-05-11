import { getPdfJsServerAssetFields, PDFJS_ROOT_VERSION } from "@/lib/server/pdfJsServerAssets";
import { installPdfJsNodeGlobals } from "@/lib/server/pdfJsNodeGlobals";
import { pdfBufferToUint8Array } from "@/lib/server/pdfBufferUint8";

/**
 * pdf-parse başarısız olduğunda yedek metin çıkarımı (pdfjs-dist kök sürümü, Vercel uyumlu).
 * Tek `getDocument` geçişi — çift deneme gecikmeyi ikiye katlıyordu.
 */
export async function extractPdfTextWithPdfJs(buffer: Buffer): Promise<string> {
  const globalsOk = await installPdfJsNodeGlobals();
  if (!globalsOk) {
    console.warn("[extractPdfTextWithPdfJs] DOMMatrix/ImageData/Path2D polyfill yok; pdfjs atlanıyor");
    return "";
  }
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const fields = getPdfJsServerAssetFields(PDFJS_ROOT_VERSION, { disableFontFace: false });
  const data = pdfBufferToUint8Array(buffer);

  try {
    const loadingTask = getDocument({ ...fields, data });
    const pdf = await loadingTask.promise;
    try {
      const parts: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const line = textContent.items
          .map((item) => {
            if (!item || typeof item !== "object") return "";
            const it = item as { str?: string };
            return typeof it.str === "string" ? it.str : "";
          })
          .join(" ");
        parts.push(line);
      }
      return parts.join("\n").trim();
    } finally {
      if (typeof pdf.destroy === "function") {
        try {
          await pdf.destroy();
        } catch (destroyErr) {
          console.warn("[extractPdfTextPdfJs] pdf.destroy failed", destroyErr);
        }
      }
    }
  } catch (e) {
    console.warn("[extractPdfTextPdfJs] extraction failed", e);
    return "";
  }
}
