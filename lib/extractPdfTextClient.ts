import { preprocessPdfPages } from "@/lib/preprocessPdfText";
import {
  getQuizUserMessage,
  QuizErrorCode,
  QUIZ_TEXT_LIMITS,
  isLikelyInvalidPdfError,
} from "@/lib/quizErrors";

/**
 * Tarayıcıda PDF metnini çıkarır ve ön işler. Hata durumunda throw etmez; { ok, text?, message? } döner.
 */
export async function extractPdfTextClient(file: File): Promise<
  | { ok: true; text: string }
  | { ok: false; message: string }
> {
  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    return { ok: false, message: getQuizUserMessage(QuizErrorCode.PDF_READ_FAILED) };
  }

  if (buffer.byteLength === 0) {
    return { ok: false, message: getQuizUserMessage(QuizErrorCode.PDF_EMPTY) };
  }

  try {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    const pdf = await pdfjs.getDocument({ data: buffer }).promise;

    const pageTexts: string[] = [];
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
      const page = await pdf.getPage(pageNo);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .trim();
      pageTexts.push(text);
    }

    const processed = preprocessPdfPages(pageTexts).trim();

    if (!processed) {
      return { ok: false, message: getQuizUserMessage(QuizErrorCode.PDF_EMPTY) };
    }

    if (processed.length < QUIZ_TEXT_LIMITS.minChars) {
      return { ok: false, message: getQuizUserMessage(QuizErrorCode.PDF_TEXT_TOO_SHORT) };
    }

    if (processed.length > QUIZ_TEXT_LIMITS.maxChars) {
      return { ok: false, message: getQuizUserMessage(QuizErrorCode.QUIZ_TEXT_TOO_LONG) };
    }

    return { ok: true, text: processed };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (isLikelyInvalidPdfError(msg)) {
      return { ok: false, message: getQuizUserMessage(QuizErrorCode.PDF_INVALID) };
    }
    return { ok: false, message: getQuizUserMessage(QuizErrorCode.PDF_READ_FAILED) };
  }
}
