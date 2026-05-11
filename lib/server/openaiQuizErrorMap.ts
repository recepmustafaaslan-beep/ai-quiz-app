import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  RateLimitError,
} from "openai/error";
import { QuizErrorCode, type QuizErrorCodeType } from "@/lib/quizErrors";

export function mapOpenAISdkErrorToCode(error: unknown): QuizErrorCodeType {
  if (error instanceof AuthenticationError) {
    return QuizErrorCode.OPENAI_AUTH;
  }
  if (error instanceof RateLimitError) {
    const msg = (error.message ?? "").toLowerCase();
    if (msg.includes("quota") || msg.includes("billing") || msg.includes("insufficient")) {
      return QuizErrorCode.OPENAI_QUOTA;
    }
    return QuizErrorCode.OPENAI_RATE_LIMIT;
  }
  if (error instanceof APIConnectionTimeoutError) {
    return QuizErrorCode.OPENAI_TIMEOUT;
  }
  if (error instanceof APIConnectionError) {
    return QuizErrorCode.OPENAI_SERVER;
  }
  if (error instanceof APIError) {
    const status = error.status;
    if (status === 401) return QuizErrorCode.OPENAI_AUTH;
    if (status === 429) {
      const msg = (error.message ?? "").toLowerCase();
      if (msg.includes("quota") || msg.includes("billing")) return QuizErrorCode.OPENAI_QUOTA;
      return QuizErrorCode.OPENAI_RATE_LIMIT;
    }
    if (status === 408 || status === 504) return QuizErrorCode.OPENAI_TIMEOUT;
    if (typeof status === "number" && status >= 500) return QuizErrorCode.OPENAI_SERVER;
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("abort") || msg.includes("timeout")) return QuizErrorCode.OPENAI_TIMEOUT;
  }
  return QuizErrorCode.OPENAI_UNKNOWN;
}
