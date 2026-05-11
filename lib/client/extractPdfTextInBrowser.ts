import { preprocessPdfPages } from "@/lib/preprocessPdfText";
import { QUIZ_TEXT_LIMITS } from "@/lib/quizErrors";

type PdfJsTextItem = { str?: string };

/**
 * Browser-side PDF → text extraction using pdfjs-dist.
 *
 * Purpose: avoid multipart upload limits (HTTP 413) by sending extracted text as JSON instead of the PDF bytes.
 */
export async function extractPdfTextInBrowser(file: File): Promise<string> {
  if (typeof window === "undefined") return "";
  if (!file || file.size === 0) return "";

  const ab = await file.arrayBuffer();
  const data = new Uint8Array(ab);

  // Use legacy build for broader bundler compatibility; disable worker to avoid extra asset wiring.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data, disableWorker: true } as unknown as never);
  const doc = await loadingTask.promise;

  try {
    const pageTexts: string[] = [];
    const maxPages = Math.max(1, Math.min(doc.numPages, 250)); // safety cap

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

      // Stop early once we have enough text for the model.
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
      if (typeof doc.destroy === "function") {
        await doc.destroy();
      }
    } catch {
      // ignore
    }
  }
}

