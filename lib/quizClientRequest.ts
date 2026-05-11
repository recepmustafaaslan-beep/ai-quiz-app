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

function stripBom(s: string): string {
  if (s.length > 0 && s.charCodeAt(0) === 0xfeff) {
    return s.slice(1);
  }
  return s;
}

function looksLikeHtmlResponse(s: string): boolean {
  const head = stripBom(s).trimStart().slice(0, 512).toLowerCase();
  return (
    head.startsWith("<!doctype") ||
    head.startsWith("<html") ||
    head.startsWith("<head") ||
    head.startsWith("<body") ||
    head.startsWith("<error")
  );
}

/** Mobil / proxy kaynaklı gürültülü gövdelerde JSON yakalamayı dener */
function tryParseApiJson(raw: string): ApiJson | null {
  const s = stripBom(raw).trim();
  if (!s) return null;

  try {
    return JSON.parse(s) as ApiJson;
  } catch {
    /* devam */
  }

  const fence = s.indexOf("```");
  if (fence >= 0) {
    let inner = s.slice(fence + 3).replace(/^\s*json\s*/i, "").trimStart();
    const close = inner.indexOf("```");
    if (close >= 0) {
      const candidate = inner.slice(0, close).trim();
      try {
        return JSON.parse(candidate) as ApiJson;
      } catch {
        /* devam */
      }
    }
  }

  if (!looksLikeHtmlResponse(s)) {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(s.slice(start, end + 1)) as ApiJson;
      } catch {
        /* devam */
      }
    }
  }

  return null;
}

/** `res.text()` yerine UTF-8 decode; bazı mobil tarayıcılarda daha tutarlı */
export async function readFetchBodyAsUtf8(res: Response): Promise<string> {
  const buf = await res.arrayBuffer();
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

/** `/api/generate-quiz` yanıt gövdesini çözümler (JSON veya multipart sonrası aynı şema) */
export function parseQuizGenerateResponse(
  res: Response,
  raw: string,
): { ok: true; questions: QuizQuestionPayload[] } | { ok: false; message: string } {
  const trimmed = typeof raw === "string" ? stripBom(raw).trim() : "";
  if (!trimmed) {
    if (!res.ok) {
      return { ok: false, message: getQuizUserMessage(QuizErrorCode.API_BAD_RESPONSE) };
    }
    return { ok: false, message: getQuizUserMessage(QuizErrorCode.API_JSON_PARSE) };
  }

  if (looksLikeHtmlResponse(trimmed)) {
    return { ok: false, message: getQuizUserMessage(QuizErrorCode.API_BAD_RESPONSE) };
  }

  const data = tryParseApiJson(trimmed);
  if (!data) {
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

export type QuizGenerateClientResult =
  | { ok: true; questions: QuizQuestionPayload[] }
  | { ok: false; message: string };

/** PDF dosyası ile quiz üretir; zaman aşımı ve gövde okuma mobil için uyarlanmıştır */
export async function requestGenerateQuizWithPdfFile(file: File): Promise<QuizGenerateClientResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLIENT_FETCH_TIMEOUT_MS);

  try {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/generate-quiz", {
      method: "POST",
      body: formData,
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    const raw = await readFetchBodyAsUtf8(res);
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
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    const raw = await readFetchBodyAsUtf8(res);
    let data: ExtractPdfJson;
    try {
      data = raw.trim() ? (JSON.parse(raw.trim()) as ExtractPdfJson) : {};
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
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ pdfText }),
      cache: "no-store",
      signal: controller.signal,
    });

    const raw = await readFetchBodyAsUtf8(res);
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
