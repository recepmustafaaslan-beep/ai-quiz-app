import { preprocessPdfPages } from "@/lib/preprocessPdfText";
import { QUIZ_TEXT_LIMITS } from "@/lib/quizErrors";

type PdfJsTextItem = { str?: string };

/**
 * Browser-side PDF → text extraction using pdfjs-dist.
 * Workaround: large files cannot be uploaded as multipart (HTTP 413 from platform/CDN).
 * Instead, extract text in the browser and send plain JSON to the API.
 */
export async function extractPdfTextInBrowser(file: File): Promise<string> {
  if (typeof window === "undefined") return "";
  if (!file || file.size === 0) return "";

  const ab = await file.arrayBuffer();
  const data = new Uint8Array(ab);

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Point workerSrc to the bundled worker file served from /_next/static/chunks via Next.js.
  // We inline a blob-worker fallback so the main thread can parse without a separate worker file.
  try {
    const workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  } catch {
    // If URL resolution fails (SSR/edge), disable worker entirely.
    pdfjs.GlobalWorkerOptions.workerSrc = "";
  }

  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;

  try {
    const pageTexts: string[] = [];
    const maxPages = Math.min(doc.numPages, 300);

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const line = (content.items as unknown[])
        .map((it) => {
          if (!it || typeof it !== "object") return "";
          const item = it as PdfJsTextItem;
          return typeof item.str === "string" ? item.str : "";
        })
        .join(" ");
      pageTexts.push(line);

      // Stop early when we have enough for the model.
      const roughLen = pageTexts.reduce((n, s) => n + s.length + 1, 0);
      if (roughLen > QUIZ_TEXT_LIMITS.maxChars * 1.2) break;
    }

    const processed = preprocessPdfPages(pageTexts);
    if (!processed) return "";
    return processed.length > QUIZ_TEXT_LIMITS.maxChars
      ? processed.slice(0, QUIZ_TEXT_LIMITS.maxChars)
      : processed;
  } finally {
    try {
      if (typeof doc.destroy === "function") await doc.destroy();
    } catch {
      // ignore
    }
  }
}
