import { getPdfJsServerAssetFields, PDFJS_ROOT_VERSION } from "@/lib/server/pdfJsServerAssets";
import { pdfBufferToUint8Array } from "@/lib/server/pdfBufferUint8";

/**
 * pdf-parse başarısız olduğunda yedek metin çıkarımı (pdfjs-dist kök sürümü, Vercel uyumlu).
 * `disableFontFace` için iki geçiş: bazı PDF’lerde gömülü font çözümü için false gerekir.
 */
export async function extractPdfTextWithPdfJs(buffer: Buffer): Promise<string> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

  for (const disableFontFace of [false, true] as const) {
    const fields = getPdfJsServerAssetFields(PDFJS_ROOT_VERSION, { disableFontFace });
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
        const out = parts.join("\n").trim();
        if (out.length > 0) return out;
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
      console.warn("[extractPdfTextPdfJs] extraction pass failed", { disableFontFace, e });
    }
  }

  return "";
}
