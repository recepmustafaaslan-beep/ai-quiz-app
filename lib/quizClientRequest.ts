import {
  getQuizUserMessage,
  isQuizErrorCode,
  messageForHttpStatus,
  QuizErrorCode,
} from "@/lib/quizErrors";
import type { QuizDifficultyPreset } from "@/lib/quizGenerationOptions";
import { extractPdfTextInBrowser } from "@/lib/client/extractPdfTextInBrowser";

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
  error?: string | { message?: string };
  code?: string | number;
  message?: string;
  detail?: string;
};

function stripBom(s: string): string {
  if (s.length > 0 && s.charCodeAt(0) === 0xfeff) {
    return s.slice(1);
  }
  return s;
}

function looksLikeHtmlResponse(s: string): boolean {
  const t = stripBom(s).trimStart();
  if (t.startsWith("{") || t.startsWith("[")) return false;
  const head = t.slice(0, 900).toLowerCase();
  if (
    head.startsWith("<!doctype") ||
    head.startsWith("<html") ||
    head.startsWith("<head") ||
    head.startsWith("<body") ||
    head.startsWith("<error") ||
    head.startsWith("<pre") ||
    head.startsWith("<div") ||
    head.includes("<meta ") ||
    head.includes("chrome error") ||
    head.includes("cloudflare")
  ) {
    return true;
  }
  return /internal server error|bad gateway|service unavailable|gateway time-out/i.test(head);
}

function parseApiJsonObject(candidate: string): ApiJson | null {
  try {
    const v = JSON.parse(candidate) as unknown;
    if (v === null || typeof v !== "object" || Array.isArray(v)) return null;
    return v as ApiJson;
  } catch {
    return null;
  }
}

/** Mobil / proxy kaynaklı gürültülü gövdelerde JSON yakalamayı dener */
function tryParseApiJson(raw: string): ApiJson | null {
  const s = stripBom(raw).trim();
  if (!s) return null;

  const direct = parseApiJsonObject(s);
  if (direct) return direct;

  const fence = s.indexOf("```");
  if (fence >= 0) {
    const inner = s.slice(fence + 3).replace(/^\s*json\s*/i, "").trimStart();
    const close = inner.indexOf("```");
    if (close >= 0) {
      const fenced = parseApiJsonObject(inner.slice(0, close).trim());
      if (fenced) return fenced;
    }
  }

  if (!looksLikeHtmlResponse(s)) {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const sliced = parseApiJsonObject(s.slice(start, end + 1));
      if (sliced) return sliced;
    }
  }

  return null;
}

function extractApiErrorText(data: ApiJson): string | null {
  const err = data.error;
  if (typeof err === "string" && err.trim()) return err.trim();
  if (err && typeof err === "object" && typeof err.message === "string" && err.message.trim()) {
    return err.message.trim();
  }
  if (typeof data.message === "string" && data.message.trim()) return data.message.trim();
  if (typeof data.detail === "string" && data.detail.trim()) return data.detail.trim();
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
      return { ok: false, message: messageForHttpStatus(res.status) };
    }
    return { ok: false, message: getQuizUserMessage(QuizErrorCode.API_JSON_PARSE) };
  }

  if (looksLikeHtmlResponse(trimmed)) {
    return {
      ok: false,
      message: res.ok
        ? "Sunucu JSON yerine HTML veya hata sayfası döndürdü. Barındırma günlüklerini (Vercel Runtime Logs) kontrol edin."
        : messageForHttpStatus(res.status),
    };
  }

  const data = tryParseApiJson(trimmed);
  if (!data) {
    if (!res.ok) {
      return { ok: false, message: messageForHttpStatus(res.status) };
    }
    return { ok: false, message: getQuizUserMessage(QuizErrorCode.API_JSON_PARSE) };
  }

  if (!res.ok) {
    const codeRaw = data.code;
    const codeStr =
      typeof codeRaw === "string" ? codeRaw.trim() : codeRaw != null ? String(codeRaw).trim() : "";
    if (codeStr && isQuizErrorCode(codeStr)) {
      return { ok: false, message: getQuizUserMessage(codeStr) };
    }
    const extracted = extractApiErrorText(data);
    if (extracted) {
      return { ok: false, message: extracted };
    }
    return { ok: false, message: messageForHttpStatus(res.status) };
  }

  const rawList = Array.isArray(data.questions) ? data.questions : [];
  return { ok: true, questions: rawList };
}

export type QuizGenerateClientResult =
  | { ok: true; questions: QuizQuestionPayload[] }
  | { ok: false; message: string };

export type QuizGenerationRequestOptions = {
  questionCount?: number;
  difficultyPreset?: QuizDifficultyPreset;
};

/** PDF dosyası ile quiz üretir; zaman aşımı ve gövde okuma mobil için uyarlanmıştır */
export async function requestGenerateQuizWithPdfFile(
  file: File,
  options?: QuizGenerationRequestOptions,
): Promise<QuizGenerateClientResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLIENT_FETCH_TIMEOUT_MS);

  try {
    const formData = new FormData();
    const safeName =
      typeof file.name === "string" && file.name.trim().length > 0 ? file.name.trim() : "document.pdf";
    formData.append("file", file, safeName);
    if (options?.questionCount != null) {
      formData.append("questionCount", String(options.questionCount));
    }
    if (options?.difficultyPreset != null) {
      formData.append("difficultyPreset", options.difficultyPreset);
    }

    const res = await fetch("/api/generate-quiz", {
      method: "POST",
      body: formData,
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    // If platform rejects multipart body as too large, fallback to browser-side extract → JSON text request.
    if (res.status === 413) {
      try {
        const text = await extractPdfTextInBrowser(file);
        if (text && text.trim().length > 0) {
          return await requestQuizGeneration(text, options);
        }
      } catch {
        // if fallback fails, continue with normal error parsing
      }
    }

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
  code?: string | number;
};

/** PDF → metin (sunucu `pdf-parse`, `/api/extract-pdf`) */
export async function requestPdfTextExtract(
  file: File,
): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLIENT_FETCH_TIMEOUT_MS);

  try {
    const formData = new FormData();
    const safeName =
      typeof file.name === "string" && file.name.trim().length > 0 ? file.name.trim() : "document.pdf";
    formData.append("file", file, safeName);

    const res = await fetch("/api/extract-pdf", {
      method: "POST",
      body: formData,
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    // If platform rejects multipart body as too large, fallback to browser-side text extraction.
    if (res.status === 413) {
      try {
        const text = await extractPdfTextInBrowser(file);
        if (text && text.trim().length > 0) {
          return { ok: true, text };
        }
      } catch {
        // continue to normal error handling below
      }
    }

    const raw = await readFetchBodyAsUtf8(res);
    let data: ExtractPdfJson;
    try {
      data = raw.trim() ? (JSON.parse(raw.trim()) as ExtractPdfJson) : {};
    } catch {
      return { ok: false, message: getQuizUserMessage(QuizErrorCode.API_JSON_PARSE) };
    }

    if (!res.ok) {
      const extCodeRaw = data.code;
      const extCodeStr =
        typeof extCodeRaw === "string"
          ? extCodeRaw.trim()
          : extCodeRaw != null
            ? String(extCodeRaw).trim()
            : "";
      if (extCodeStr && isQuizErrorCode(extCodeStr)) {
        return { ok: false, message: getQuizUserMessage(extCodeStr) };
      }
      if (typeof data.error === "string" && data.error.trim()) {
        return { ok: false, message: data.error.trim() };
      }
      return { ok: false, message: messageForHttpStatus(res.status) };
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
  options?: QuizGenerationRequestOptions,
): Promise<{ ok: true; questions: QuizQuestionPayload[] } | { ok: false; message: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLIENT_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch("/api/generate-quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        pdfText,
        ...(options?.questionCount != null ? { questionCount: options.questionCount } : {}),
        ...(options?.difficultyPreset != null ? { difficultyPreset: options.difficultyPreset } : {}),
      }),
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
