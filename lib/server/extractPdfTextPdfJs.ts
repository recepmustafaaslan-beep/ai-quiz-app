import { pdfBufferToUint8Array } from "@/lib/server/pdfBufferUint8";

/** `package.json` ile uyumlu; unpkg üzerinden CMap / standart font (Vercel’de eksik dosya sorunu) */
const PDFJS_DIST_VERSION = "5.7.284";
const PDFJS_ASSET_BASE = `https://unpkg.com/pdfjs-dist@${PDFJS_DIST_VERSION}/`;

/**
 * pdf-parse / native katman başarısız olduğunda yedek metin çıkarımı (saf JS, Vercel uyumlu).
 */
export async function extractPdfTextWithPdfJs(buffer: Buffer): Promise<string> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = pdfBufferToUint8Array(buffer);
  const loadingTask = getDocument({
    data,
    useSystemFonts: true,
    verbosity: 0,
    disableFontFace: true,
    useWorkerFetch: false,
    cMapUrl: `${PDFJS_ASSET_BASE}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${PDFJS_ASSET_BASE}standard_fonts/`,
  });
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
      } catch (e) {
        console.warn("[extractPdfTextPdfJs] pdf.destroy failed", e);
      }
    }
  }
}
