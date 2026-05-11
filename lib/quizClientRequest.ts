import {
  getQuizUserMessage,
  isQuizErrorCode,
  QuizErrorCode,
} from "@/lib/quizErrors";

const CLIENT_FETCH_TIMEOUT_MS = 120_000;

export type QuizQuestionPayload = {
  question: string;
  options: [string, string, string, string];
  correctAnswerIndex: 0 | 1 | 2 | 3;
  difficulty: "easy" | "medium" | "hard";
  explanation?: string;
};

type ApiJson = {
  questions?: QuizQuestionPayload[];
  error?: string;
  code?: string;
};

/** `/api/generate-quiz` yanıt gövdesini çözümler (JSON veya multipart sonrası aynı şema) */
export function parseQuizGenerateResponse(
  res: Response,
  raw: string,
): { ok: true; questions: QuizQuestionPayload[] } | { ok: false; message: string } {
  let data: ApiJson;
  try {
    data = raw ? (JSON.parse(raw) as ApiJson) : {};
  } catch {
    return { ok: false, message: getQuizUserMessage(QuizErrorCode.API_JSON_PARSE) };
  }

  if (!res.ok) {
    if (data.code && isQuizErrorCode(data.code)) {
      return { ok: false, message: getQuizUserMessage(data.code) };
    }
    if (typeof data.error === "string" && data.error.trim()) {
      return { ok: false, message: data.error.trim() };
    }
    return { ok: false, message: getQuizUserMessage(QuizErrorCode.API_BAD_RESPONSE) };
  }

  const rawList = Array.isArray(data.questions) ? data.questions : [];
  return { ok: true, questions: rawList };
}

type ExtractPdfJson = {
  text?: string;
  error?: string;
  code?: string;
};

/** PDF → metin (sunucu `pdf-parse`, `/api/extract-pdf`) */
export async function requestPdfTextExtract(
  file: File,
): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLIENT_FETCH_TIMEOUT_MS);

  try {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/extract-pdf", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    const raw = await res.text();
    let data: ExtractPdfJson;
    try {
      data = raw ? (JSON.parse(raw) as ExtractPdfJson) : {};
    } catch {
      return { ok: false, message: getQuizUserMessage(QuizErrorCode.API_JSON_PARSE) };
    }

    if (!res.ok) {
      if (data.code && isQuizErrorCode(data.code)) {
        return { ok: false, message: getQuizUserMessage(data.code) };
      }
      if (typeof data.error === "string" && data.error.trim()) {
        return { ok: false, message: data.error.trim() };
      }
      return { ok: false, message: getQuizUserMessage(QuizErrorCode.API_BAD_RESPONSE) };
    }

    const text = typeof data.text === "string" ? data.text : "";
    if (!text.trim()) {
      return { ok: false, message: data.error?.trim() || getQuizUserMessage(QuizErrorCode.PDF_EMPTY) };
    }

    return { ok: true, text };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, message: getQuizUserMessage(QuizErrorCode.REQUEST_TIMEOUT) };
    }
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, message: getQuizUserMessage(QuizErrorCode.REQUEST_TIMEOUT) };
    }
    return { ok: false, message: getQuizUserMessage(QuizErrorCode.NETWORK) };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function requestQuizGeneration(
  pdfText: string,
): Promise<{ ok: true; questions: QuizQuestionPayload[] } | { ok: false; message: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLIENT_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch("/api/generate-quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfText }),
      signal: controller.signal,
    });

    const raw = await res.text();
    return parseQuizGenerateResponse(res, raw);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, message: getQuizUserMessage(QuizErrorCode.REQUEST_TIMEOUT) };
    }
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, message: getQuizUserMessage(QuizErrorCode.REQUEST_TIMEOUT) };
    }
    return { ok: false, message: getQuizUserMessage(QuizErrorCode.NETWORK) };
  } finally {
    clearTimeout(timeoutId);
  }
}
