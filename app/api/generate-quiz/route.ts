import OpenAI from "openai";
import { NextResponse } from "next/server";
import { preprocessExtractedPdfForAi } from "@/lib/preprocessPdfText";
import {
  getQuizUserMessage,
  QuizErrorCode,
  type QuizErrorCodeType,
  QUIZ_TEXT_LIMITS,
  QUIZ_UPLOAD_LIMITS,
  isLikelyInvalidPdfError,
} from "@/lib/quizErrors";
import { mapOpenAISdkErrorToCode } from "@/lib/server/openaiQuizErrorMap";
import { extractPdfTextWithPdfParse } from "@/lib/server/pdfParseExtract";
import { bufferHasPdfSignature } from "@/lib/server/pdfSignature";
import { readUploadFileBuffer } from "@/lib/server/readUploadFileBuffer";
import {
  buildQuizSystemPrompt,
  buildRepairSystemPrompt,
  buildTargetDifficultyOrder,
  countsMatchTarget,
  normalizeDifficultyForQuiz,
  parseDifficultyPreset,
  parseQuestionCount,
  rebalanceToTargets,
  targetCountsForPreset,
  type QuizDifficultyPreset,
} from "@/lib/quizGenerationOptions";
import { equalizeCorrectAnswerIndices } from "@/lib/equalizeCorrectAnswerIndices";
import { tryParseQuizModelJson } from "@/lib/parseQuizModelJson";
import { truncateQuizSourceText } from "@/lib/server/truncateQuizSourceText";

export const runtime = "nodejs";

/**
 * Üretimde (Vercel dahil) işlev ~60 sn ile sınırlı; daha uzun sürerse platform isteği keser ve
 * çoğunlukla HTML döner → istemci "JSON işlenemedi" görür. Sabit export Next segment kuralları için gerekli.
 * Daha uzun süre: Vercel Pro + panelde Function Duration ve bu değeri artırın.
 */
export const maxDuration = 60;

type Difficulty = "easy" | "medium" | "hard";

type QuizQuestion = {
  question: string;
  options: [string, string, string, string];
  correctAnswerIndex: 0 | 1 | 2 | 3;
  difficulty: Difficulty;
  /** Doğru cevabın gerekçesi; yanlışta gösterilir */
  explanation: string;
};

type QuizResponse = {
  questions: Array<QuizQuestion & { difficulty?: unknown }>;
};

function getOpenAIClient(): OpenAI {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const QUIZ_MODEL = process.env.OPENAI_QUIZ_MODEL?.trim() || "gpt-4o-mini";

/** Üretimde maxDuration (60s) içinde kal; tamamlama + repair için pay bırakılır */
const OPENAI_TIMEOUT_MS = process.env.NODE_ENV === "development" ? 120_000 : 44_000;
const QUIZ_MAX_COMPLETION_TOKENS = 16_000;
const REPAIR_TIMEOUT_MS = process.env.NODE_ENV === "development" ? 45_000 : 28_000;
const FILL_TIMEOUT_MS = process.env.NODE_ENV === "development" ? 35_000 : 24_000;
const REPAIR_JSON_MAX_CHARS = 120_000;
const MAX_REPAIR_ROUNDS = 3;
const MAX_FILL_ROUNDS = 5;

function jsonError(code: QuizErrorCodeType, status: number) {
  return NextResponse.json({ code, error: getQuizUserMessage(code) }, { status });
}

function statusForOpenAIError(code: QuizErrorCodeType): number {
  if (code === QuizErrorCode.OPENAI_AUTH) return 401;
  if (code === QuizErrorCode.OPENAI_RATE_LIMIT || code === QuizErrorCode.OPENAI_QUOTA) return 429;
  if (code === QuizErrorCode.OPENAI_TIMEOUT) return 504;
  if (code === QuizErrorCode.OPENAI_SERVER) return 503;
  return 502;
}

/** OpenAI SDK v6: `message.content` string | parça dizisi | null olabilir */
function extractAssistantCompletionText(message: {
  content?: string | null | Array<{ type?: string; text?: string; refusal?: string }>;
  refusal?: string | null;
} | undefined): { text: string; refusal: string | null } {
  if (!message) {
    return { text: "", refusal: null };
  }
  const topRefusal =
    typeof message.refusal === "string" && message.refusal.trim().length > 0
      ? message.refusal.trim()
      : null;
  const c = message.content;
  if (c == null) {
    return { text: "", refusal: topRefusal };
  }
  if (typeof c === "string") {
    return { text: c, refusal: topRefusal };
  }
  if (Array.isArray(c)) {
    const texts: string[] = [];
    let partRefusal: string | null = null;
    for (const part of c) {
      if (!part || typeof part !== "object") continue;
      if (part.type === "text" && typeof part.text === "string") {
        texts.push(part.text);
      }
      if (part.type === "refusal" && typeof part.refusal === "string" && part.refusal.trim()) {
        partRefusal = part.refusal.trim();
      }
    }
    return { text: texts.join(""), refusal: topRefusal ?? partRefusal };
  }
  return { text: "", refusal: topRefusal };
}

function parseCorrectAnswerIndex(idxRaw: unknown): 0 | 1 | 2 | 3 | null {
  const n = typeof idxRaw === "number" ? idxRaw : Number(idxRaw);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r === 0 || r === 1 || r === 2 || r === 3) return r;
  return null;
}

function sanitizeQuizQuestionsFromParsed(
  parsed: QuizResponse,
  limit: number,
): QuizQuestion[] {
  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
  const fallbackExplanation =
    "Bu soruda doğru cevap, ders metnindeki ilgili kavrama ve tanımlara en uygun seçenektir.";

  return questions
    .map((q) => {
      const idx = parseCorrectAnswerIndex((q as { correctAnswerIndex?: unknown }).correctAnswerIndex);
      return { q, idx };
    })
    .filter(({ q, idx }) => {
      return (
        typeof q?.question === "string" &&
        q.question.trim().length > 0 &&
        Array.isArray(q?.options) &&
        q.options.length >= 4 &&
        idx !== null
      );
    })
    .slice(0, limit)
    .map(({ q, idx }) => {
      const d = normalizeDifficultyForQuiz(q.difficulty) ?? "medium";
      const rawEx =
        typeof (q as { explanation?: unknown }).explanation === "string"
          ? String((q as { explanation?: string }).explanation).trim()
          : "";
      const o = q.options as unknown[];
      return {
        question: q.question.trim(),
        options: [String(o[0]), String(o[1]), String(o[2]), String(o[3])] as [
          string,
          string,
          string,
          string,
        ],
        correctAnswerIndex: idx!,
        difficulty: d,
        explanation: rawEx.length > 0 ? rawEx : fallbackExplanation,
      };
    });
}

async function runOpenAiQuizJson(
  client: OpenAI,
  model: string,
  system: string,
  user: string,
  maxOut: number,
  temperature: number,
  signal: AbortSignal,
): Promise<string | null> {
  const completion = await client.chat.completions.create(
    {
      model,
      temperature,
      max_completion_tokens: maxOut,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    },
    { signal },
  );
  const { text, refusal } = extractAssistantCompletionText(completion.choices[0]?.message);
  if (refusal || !text?.trim()) return null;
  return text;
}

/** Eksik soru sayısı için kısa ikinci tur (küçük çıktı) */
async function generateFillInQuestions(
  client: OpenAI,
  model: string,
  sourceText: string,
  need: number,
  difficultiesNeeded: Difficulty[],
  signal: AbortSignal,
  maxCompletionTokens?: number,
): Promise<QuizResponse | null> {
  if (need <= 0 || difficultiesNeeded.length !== need) return null;
  const orderHint = difficultiesNeeded.map((d, i) => `${i + 1}:${d}`).join(", ");
  const fillTokens =
    maxCompletionTokens ?? Math.min(12_000, 1_600 + need * 900);
  const sys = [
    "Görev: Verilen ders notundan yalnızca eksik kalan quiz sorularını üret.",
    'Çıktı: yalnızca geçerli JSON nesnesi, kök anahtar "questions" (dizi).',
    `Tam olarak ${need} soru üret; difficulty için tercih sırası: ${orderHint} (uyamazsan hepsi "medium" olabilir, sunucu düzeltir).`,
    "Her soru: question (string), options (en az 4 string; fazlaysa ilk 4), correctAnswerIndex 0-3, difficulty, explanation (string).",
    "Akademik Türkçe; tek doğru şık.",
  ].join(" ");
  const user = `Ders metni:\n${sourceText}`;
  let raw: string | null;
  try {
    raw = await runOpenAiQuizJson(
      client,
      model,
      sys,
      user,
      fillTokens,
      0.32,
      signal,
    );
  } catch (e) {
    console.warn("[generate-quiz] generateFillInQuestions request failed", e);
    return null;
  }
  if (!raw) return null;
  const loose = tryParseQuizModelJson(raw);
  if (!loose) return null;
  return { questions: loose.questions as QuizResponse["questions"] };
}

async function tryFillRemainingQuestions(
  client: OpenAI,
  model: string,
  pdfForModel: string,
  base: QuizQuestion[],
  questionCount: number,
  targetOrder: Difficulty[],
): Promise<QuizQuestion[] | null> {
  if (base.length === 0 || base.length >= questionCount) return null;
  let acc = rebalanceToTargets(base, targetOrder.slice(0, base.length));
  for (let r = 0; r < MAX_FILL_ROUNDS && acc.length < questionCount; r++) {
    const need = questionCount - acc.length;
    const chunk = Math.min(need, 4);
    const suffixTargets = targetOrder.slice(acc.length, acc.length + chunk);
    const fillParsed = await generateFillInQuestions(
      client,
      model,
      pdfForModel,
      chunk,
      suffixTargets,
      AbortSignal.timeout(FILL_TIMEOUT_MS),
    );
    if (!fillParsed) continue;
    const part = sanitizeQuizQuestionsFromParsed(fillParsed, chunk);
    if (part.length === 0) continue;
    const add = part.slice(0, Math.min(part.length, need));
    acc = [...acc, ...add];
  }
  return acc.length === questionCount ? acc : null;
}

async function repairQuizResponseJson(
  client: OpenAI,
  model: string,
  broken: QuizResponse,
  questionCount: number,
  difficultyPreset: QuizDifficultyPreset,
  repairSignal: AbortSignal,
): Promise<QuizResponse | null> {
  const sys = buildRepairSystemPrompt(questionCount, difficultyPreset);

  let completion;
  try {
    completion = await client.chat.completions.create(
      {
        model,
        temperature: 0.15,
        max_completion_tokens: 16_000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          {
            role: "user",
            content: `Bu JSON'u şartlara göre düzelt:\n${JSON.stringify(broken).slice(0, REPAIR_JSON_MAX_CHARS)}`,
          },
        ],
      },
      { signal: repairSignal },
    );
  } catch (e) {
    console.warn("[generate-quiz] repairQuizResponseJson request failed", e);
    return null;
  }

  const { text, refusal } = extractAssistantCompletionText(completion.choices[0]?.message);
  if (refusal || !text?.trim()) return null;
  const loose = tryParseQuizModelJson(text);
  if (loose && Array.isArray(loose.questions)) {
    return { questions: loose.questions as QuizResponse["questions"] };
  }
  try {
    return JSON.parse(text) as QuizResponse;
  } catch {
    return null;
  }
}

async function resolvePdfTextFromRequest(req: Request): Promise<
  | {
      ok: true;
      pdfText: string;
      questionCount: number;
      difficultyPreset: QuizDifficultyPreset;
    }
  | { ok: false; response: Response }
> {
  const ct = req.headers.get("content-type") ?? "";

  try {
    if (ct.includes("multipart/form-data")) {
      let formData: FormData;
      try {
        formData = await req.formData();
      } catch (e) {
        console.error("[generate-quiz] formData parse failed", e);
        return { ok: false, response: jsonError(QuizErrorCode.BODY_INVALID, 400) };
      }

      const questionCount = parseQuestionCount(formData.get("questionCount"));
      const difficultyPreset = parseDifficultyPreset(formData.get("difficultyPreset"));

      const file = formData.get("file");
      const fileExists = file != null && !(typeof file === "string" && file.length === 0);
      const fileSize = typeof file === "object" && file && "size" in file ? (file as File).size : undefined;
      const fileType =
        typeof file === "object" && file && "type" in file ? String((file as File).type || "") : undefined;
      console.log("[generate-quiz] multipart file", {
        exists: fileExists,
        fieldKind: typeof file,
        size: fileSize,
        type: fileType,
      });

      if (!file) {
        return { ok: false, response: jsonError(QuizErrorCode.BODY_INVALID, 400) };
      }
      if (typeof file === "string") {
        return { ok: false, response: jsonError(QuizErrorCode.BODY_INVALID, 400) };
      }

      const pdfFile = file as File;

      if (pdfFile.size === 0) {
        return { ok: false, response: jsonError(QuizErrorCode.FILE_EMPTY, 400) };
      }
      if (pdfFile.size > QUIZ_UPLOAD_LIMITS.maxFileBytes) {
        return { ok: false, response: jsonError(QuizErrorCode.PDF_TOO_LARGE, 400) };
      }
      const name = pdfFile.name?.toLowerCase() ?? "";
      const type = pdfFile.type;

      const read = await readUploadFileBuffer(pdfFile);
      if (!read.ok) {
        console.warn("[generate-quiz] file buffer read failed", read.reason);
        return {
          ok: false,
          response: jsonError(
            read.reason === "empty" ? QuizErrorCode.FILE_EMPTY : QuizErrorCode.PDF_READ_FAILED,
            400,
          ),
        };
      }
      const buffer = read.buffer;

      const pdfSig = bufferHasPdfSignature(buffer);
      const mime = (type || "").toLowerCase();
      const clearlyWrongMedia =
        mime.startsWith("image/") || mime.startsWith("video/") || mime.startsWith("audio/");
      if (clearlyWrongMedia && !pdfSig) {
        return { ok: false, response: jsonError(QuizErrorCode.PDF_INVALID, 400) };
      }
      if (!pdfSig && mime && !/^application\/(pdf|octet-stream|x-pdf)$/i.test(mime) && !name.endsWith(".pdf")) {
        return { ok: false, response: jsonError(QuizErrorCode.PDF_INVALID, 400) };
      }

      let raw: string;
      try {
        raw = await extractPdfTextWithPdfParse(buffer);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const code = isLikelyInvalidPdfError(msg) ? QuizErrorCode.PDF_INVALID : QuizErrorCode.PDF_READ_FAILED;
        return { ok: false, response: jsonError(code, 400) };
      }

      if (!raw) {
        return { ok: false, response: jsonError(QuizErrorCode.PDF_EMPTY, 400) };
      }

      const text = preprocessExtractedPdfForAi(raw);
      if (!text || text.trim().length === 0) {
        return { ok: false, response: jsonError(QuizErrorCode.PDF_EMPTY, 400) };
      }

      console.log("[generate-quiz] extractedPdfTextLength", text.length);

      if (text.length < QUIZ_TEXT_LIMITS.minChars) {
        return { ok: false, response: jsonError(QuizErrorCode.PDF_TEXT_TOO_SHORT, 400) };
      }
      if (text.length > QUIZ_TEXT_LIMITS.maxChars) {
        return { ok: false, response: jsonError(QuizErrorCode.QUIZ_TEXT_TOO_LONG, 400) };
      }

      return { ok: true, pdfText: text, questionCount, difficultyPreset };
    }

    let body: { pdfText?: string; questionCount?: unknown; difficultyPreset?: unknown };
    try {
      body = (await req.json()) as {
        pdfText?: string;
        questionCount?: unknown;
        difficultyPreset?: unknown;
      };
    } catch (e) {
      console.error("[generate-quiz] JSON body parse failed", e);
      return { ok: false, response: jsonError(QuizErrorCode.BODY_INVALID, 400) };
    }

    const text = typeof body?.pdfText === "string" ? body.pdfText.trim() : "";
    if (!text || text.trim().length === 0) {
      return { ok: false, response: jsonError(QuizErrorCode.PDF_EMPTY, 400) };
    }

    console.log("[generate-quiz] extractedPdfTextLength", text.length);

    if (text.length < QUIZ_TEXT_LIMITS.minChars) {
      return { ok: false, response: jsonError(QuizErrorCode.PDF_TEXT_TOO_SHORT, 400) };
    }
    if (text.length > QUIZ_TEXT_LIMITS.maxChars) {
      return { ok: false, response: jsonError(QuizErrorCode.QUIZ_TEXT_TOO_LONG, 400) };
    }
    const questionCount = parseQuestionCount(body?.questionCount);
    const difficultyPreset = parseDifficultyPreset(body?.difficultyPreset);
    return { ok: true, pdfText: text, questionCount, difficultyPreset };
  } catch (error) {
    console.error("[generate-quiz] resolvePdfTextFromRequest unexpected", error);
    return {
      ok: false,
      response: NextResponse.json(
        {
          code: QuizErrorCode.PDF_READ_FAILED,
          error: getQuizUserMessage(QuizErrorCode.PDF_READ_FAILED),
        },
        { status: 400 },
      ),
    };
  }
}

export async function POST(req: Request) {
  try {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return jsonError(QuizErrorCode.SERVER_CONFIG, 500);
  }

  const resolved = await resolvePdfTextFromRequest(req);
  if (!resolved.ok) {
    return resolved.response;
  }
  const { pdfText, questionCount, difficultyPreset } = resolved;
  const pdfForModel = truncateQuizSourceText(pdfText);
  const targetOrder = buildTargetDifficultyOrder(difficultyPreset, questionCount);
  const targetCounts = targetCountsForPreset(difficultyPreset, questionCount);
  const systemPrompt = buildQuizSystemPrompt(questionCount, difficultyPreset);

  const client = getOpenAIClient();
  const model = QUIZ_MODEL;

  let raw: string | null;
  try {
    const signal = AbortSignal.timeout(OPENAI_TIMEOUT_MS);
    raw = await runOpenAiQuizJson(
      client,
      model,
      systemPrompt,
      pdfForModel,
      QUIZ_MAX_COMPLETION_TOKENS,
      0.3,
      signal,
    );
  } catch (error) {
    const code = mapOpenAISdkErrorToCode(error);
    return NextResponse.json(
      { code, error: getQuizUserMessage(code) },
      { status: statusForOpenAIError(code) },
    );
  }

  if (!raw?.trim()) {
    return NextResponse.json(
      { code: QuizErrorCode.MODEL_EMPTY, error: getQuizUserMessage(QuizErrorCode.MODEL_EMPTY) },
      { status: 502 },
    );
  }

  const looseFirst = tryParseQuizModelJson(raw);
  let parsed: QuizResponse;
  if (looseFirst && Array.isArray(looseFirst.questions)) {
    parsed = { questions: looseFirst.questions as QuizResponse["questions"] };
  } else {
    try {
      parsed = JSON.parse(raw) as QuizResponse;
    } catch {
      return NextResponse.json(
        {
          code: QuizErrorCode.MODEL_JSON_INVALID,
          error: getQuizUserMessage(QuizErrorCode.MODEL_JSON_INVALID),
        },
        { status: 502 },
      );
    }
  }

  let sanitizedQuestions: QuizQuestion[];
  try {
    sanitizedQuestions = sanitizeQuizQuestionsFromParsed(parsed, questionCount);
  } catch (sanitizeErr) {
    console.error("[generate-quiz] sanitize questions failed", sanitizeErr);
    return NextResponse.json(
      {
        code: QuizErrorCode.MODEL_JSON_INVALID,
        error: getQuizUserMessage(QuizErrorCode.MODEL_JSON_INVALID),
      },
      { status: 502 },
    );
  }

  const rawQuestionCount = Array.isArray(parsed.questions) ? parsed.questions.length : 0;

  const shapeOkResponse = (qs: QuizQuestion[]): NextResponse | null => {
    if (qs.length === questionCount && countsMatchTarget(qs, targetCounts)) {
      return NextResponse.json({ questions: equalizeCorrectAnswerIndices(qs) });
    }
    if (qs.length === questionCount) {
      console.warn("[generate-quiz] model difficulty counts off; applying target rebalance", {
        easy: qs.filter((q) => q.difficulty === "easy").length,
        medium: qs.filter((q) => q.difficulty === "medium").length,
        hard: qs.filter((q) => q.difficulty === "hard").length,
        questionCount,
        difficultyPreset,
      });
      return NextResponse.json({
        questions: equalizeCorrectAnswerIndices(rebalanceToTargets(qs, targetOrder)),
      });
    }
    return null;
  };

  const firstOk = shapeOkResponse(sanitizedQuestions);
  if (firstOk) return firstOk;

  if (
    sanitizedQuestions.length !== questionCount &&
    (sanitizedQuestions.length > 0 || rawQuestionCount > 0)
  ) {
    try {
      let broken: QuizResponse = parsed;
      for (let repairRound = 0; repairRound < MAX_REPAIR_ROUNDS; repairRound++) {
        const repaired = await repairQuizResponseJson(
          client,
          model,
          broken,
          questionCount,
          difficultyPreset,
          AbortSignal.timeout(REPAIR_TIMEOUT_MS),
        );
        if (!repaired) break;
        broken = repaired;
        parsed = repaired;
        sanitizedQuestions = sanitizeQuizQuestionsFromParsed(repaired, questionCount);
        const afterRepair = shapeOkResponse(sanitizedQuestions);
        if (afterRepair) return afterRepair;
      }
    } catch (repairErr) {
      console.warn("[generate-quiz] repair path failed", repairErr);
    }
  }

  if (sanitizedQuestions.length >= 1 && sanitizedQuestions.length < questionCount) {
    try {
      const filled = await tryFillRemainingQuestions(
        client,
        model,
        pdfForModel,
        sanitizedQuestions,
        questionCount,
        targetOrder,
      );
      if (filled) {
        const mergedOk = shapeOkResponse(filled);
        if (mergedOk) return mergedOk;
      }
    } catch (fillErr) {
      console.warn("[generate-quiz] fill-in path failed", fillErr);
    }
  }

  if (sanitizedQuestions.length !== questionCount) {
    try {
      const retrySys = `${buildQuizSystemPrompt(questionCount, difficultyPreset)}\n\nKRİTİK: Önceki yanıtta soru sayısı veya şema eksik kaldı. Bu yanıtta mutlaka tam ${questionCount} soru ve eksiksiz JSON üret; tüm soruların difficulty alanını geçici olarak \"medium\" yapabilirsin (sunucu hedefe çeker).`;
      const retryRaw = await runOpenAiQuizJson(
        client,
        model,
        retrySys,
        pdfForModel,
        QUIZ_MAX_COMPLETION_TOKENS,
        0.22,
        AbortSignal.timeout(Math.min(OPENAI_TIMEOUT_MS, 34_000)),
      );
      if (retryRaw) {
        const loose2 = tryParseQuizModelJson(retryRaw);
        if (loose2?.questions) {
          const parsed2: QuizResponse = {
            questions: loose2.questions as QuizResponse["questions"],
          };
          sanitizedQuestions = sanitizeQuizQuestionsFromParsed(parsed2, questionCount);
          const retryOk = shapeOkResponse(sanitizedQuestions);
          if (retryOk) return retryOk;
        }
      }
    } catch (retryErr) {
      console.warn("[generate-quiz] retry generation failed", retryErr);
    }
  }

  if (sanitizedQuestions.length >= 1 && sanitizedQuestions.length < questionCount) {
    try {
      const filled2 = await tryFillRemainingQuestions(
        client,
        model,
        pdfForModel,
        sanitizedQuestions,
        questionCount,
        targetOrder,
      );
      if (filled2) {
        const ok2 = shapeOkResponse(filled2);
        if (ok2) return ok2;
      }
    } catch (e) {
      console.warn("[generate-quiz] post-retry fill failed", e);
    }
  }

  return NextResponse.json(
    {
      code: QuizErrorCode.MODEL_SHAPE_INVALID,
      error: getQuizUserMessage(QuizErrorCode.MODEL_SHAPE_INVALID),
      questions: equalizeCorrectAnswerIndices(sanitizedQuestions),
    },
    { status: 502 },
  );
  } catch (error) {
    console.error(
      "[generate-quiz] POST unhandled",
      error instanceof Error ? { message: error.message, name: error.name, stack: error.stack } : error,
    );

    return NextResponse.json(
      {
        code: QuizErrorCode.OPENAI_UNKNOWN,
        error: getQuizUserMessage(QuizErrorCode.OPENAI_UNKNOWN),
      },
      { status: 500 },
    );
  }
}
