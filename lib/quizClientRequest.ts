import {
  getQuizUserMessage,
  isQuizErrorCode,
  QuizErrorCode,
} from "@/lib/quizErrors";

const CLIENT_FETCH_TIMEOUT_MS = 120_000;

type QuizQuestionPayload = {
  question: string;
  options: [string, string, string, string];
  correctAnswerIndex: 0 | 1 | 2 | 3;
  difficulty: "easy" | "medium" | "hard";
};

type ApiJson = {
  questions?: QuizQuestionPayload[];
  error?: string;
  code?: string;
};

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
      if (data.error) {
        return { ok: false, message: data.error };
      }
      return { ok: false, message: getQuizUserMessage(QuizErrorCode.API_BAD_RESPONSE) };
    }

    const rawList = Array.isArray(data.questions) ? data.questions : [];
    return { ok: true, questions: rawList };
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
