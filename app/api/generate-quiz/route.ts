import OpenAI from "openai";
import { NextResponse } from "next/server";
import { preprocessPdfText } from "@/lib/preprocessPdfText";
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
import { readUploadFileBuffer } from "@/lib/server/readUploadFileBuffer";

export const runtime = "nodejs";

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

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OPENAI_TIMEOUT_MS = 120_000;

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

async function resolvePdfTextFromRequest(req: Request): Promise<
  { ok: true; pdfText: string } | { ok: false; response: Response }
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
        return { ok: false, response: jsonError(QuizErrorCode.PDF_READ_FAILED, 400) };
      }
      if (pdfFile.size > QUIZ_UPLOAD_LIMITS.maxFileBytes) {
        return { ok: false, response: jsonError(QuizErrorCode.PDF_TOO_LARGE, 400) };
      }
      const name = pdfFile.name?.toLowerCase() ?? "";
      const type = pdfFile.type;
      if (type && type !== "application/pdf" && !name.endsWith(".pdf")) {
        return { ok: false, response: jsonError(QuizErrorCode.PDF_INVALID, 400) };
      }

      const read = await readUploadFileBuffer(pdfFile);
      if (!read.ok) {
        console.warn("[generate-quiz] file buffer read failed", read.reason);
        return { ok: false, response: jsonError(QuizErrorCode.PDF_READ_FAILED, 400) };
      }
      const buffer = read.buffer;

      let raw: string;
      try {
        raw = await extractPdfTextWithPdfParse(buffer);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const code = isLikelyInvalidPdfError(msg) ? QuizErrorCode.PDF_INVALID : QuizErrorCode.PDF_READ_FAILED;
        return { ok: false, response: jsonError(code, 400) };
      }

      if (!raw) {
        return { ok: false, response: jsonError(QuizErrorCode.PDF_READ_FAILED, 400) };
      }

      const text = preprocessPdfText(raw);
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

      return { ok: true, pdfText: text };
    }

    let body: { pdfText?: string };
    try {
      body = (await req.json()) as { pdfText?: string };
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
    return { ok: true, pdfText: text };
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
  const resolved = await resolvePdfTextFromRequest(req);
  if (!resolved.ok) {
    return resolved.response;
  }
  const { pdfText } = resolved;

  if (!process.env.OPENAI_API_KEY) {
    return jsonError(QuizErrorCode.SERVER_CONFIG, 500);
  }

  const systemPrompt = `
Rolün: Sen, yükseköğretimde uzman bir üniversite eğitmenisin.

Görev: Sana ayrı bir kullanıcı mesajı olarak gönderilen ders notu metninden yüksek kaliteli çoktan seçmeli quiz soruları üretmek.

Zorluk dağılımı (tam olarak uygula; sıra önemli değil):
- 2 soru: difficulty "easy" (NOT: basit ezber veya tanım ezberi değil; göreceli olarak daha erişilebilir kavram sorusu)
- 4 soru: difficulty "medium"
- 4 soru: difficulty "hard"

Pedagoji ve kalite kuralları:
- Yalnızca metindeki önemli kavramlar, ilişkiler, gerekçe ve çıkarımlardan soru üret; önemsiz detaydan kaçın.
- Ezber/tanım tekrarı sorma; anlama, yorumlama, karşılaştırma, uygulama ve analiz düzeyinde sor.
- Sorular akademik Türkçe ile yazılsın; konuşma dili ve aşırı kısa başlık tarzı ifadeler kullanma.
- Her soruda tam 4 seçenek olsun; tek doğru cevap olsun; seçenekler birbirine anlamca yakın "tuzak" ama akademik olarak tutarlı olsun.
- Doğru cevabın konumu (correctAnswerIndex) 0,1,2,3 arasında mümkün olduğunca dengeli dağılsın (örneğin her indekse yakın sayıda).
- Soru kökleri net, seçenekler dilbilgisi olarak paralel yapıda olsun.
- Her soru için "explanation" alanı zorunlu: akademik Türkçe, 2–4 cümle; doğru seçeneğin ders metnine dayalı kısa gerekçesini yaz. Yanlış cevapta öğrenciye gösterilecek; doğru şıkkı savunur nitelikte olsun, diğer şıkları tek tek eleştirme.

Çıktı biçimi:
- Yalnızca geçerli JSON dön; markdown, kod bloğu veya açıklama metni ekleme.
- Tam olarak 10 soru üret.

JSON şablonu (birebir anahtarlar):
{
  "questions": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctAnswerIndex": 0,
      "difficulty": "easy",
      "explanation": "string"
    }
  ]
}

Kurallar:
- correctAnswerIndex yalnızca 0, 1, 2 veya 3 olabilir.
- difficulty yalnızca "easy", "medium" veya "hard" olabilir.
- explanation her soruda anlamlı, boş olmayan bir metin olmalıdır.
`.trim();

  let completion;
  try {
    const signal = AbortSignal.timeout(OPENAI_TIMEOUT_MS);
    completion = await client.chat.completions.create(
      {
        model: "gpt-4.1-mini",
        temperature: 0.35,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: pdfText,
          },
        ],
      },
      { signal },
    );
  } catch (error) {
    const code = mapOpenAISdkErrorToCode(error);
    return NextResponse.json(
      { code, error: getQuizUserMessage(code) },
      { status: statusForOpenAIError(code) },
    );
  }

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    return NextResponse.json(
      { code: QuizErrorCode.MODEL_EMPTY, error: getQuizUserMessage(QuizErrorCode.MODEL_EMPTY) },
      { status: 502 },
    );
  }

  let parsed: QuizResponse;
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

  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];

  const isDifficulty = (d: unknown): d is Difficulty =>
    d === "easy" || d === "medium" || d === "hard";

  const fallbackExplanation =
    "Bu soruda doğru cevap, ders metnindeki ilgili kavrama ve tanımlara en uygun seçenektir.";

  const sanitizedQuestions: QuizQuestion[] = questions
    .filter(
      (q) =>
        typeof q?.question === "string" &&
        Array.isArray(q?.options) &&
        q.options.length === 4 &&
        [0, 1, 2, 3].includes(q.correctAnswerIndex) &&
        isDifficulty(q.difficulty),
    )
    .slice(0, 10)
    .map((q) => {
      const rawEx =
        typeof (q as { explanation?: unknown }).explanation === "string"
          ? String((q as { explanation?: string }).explanation).trim()
          : "";
      return {
        question: q.question,
        options: [
          String(q.options[0]),
          String(q.options[1]),
          String(q.options[2]),
          String(q.options[3]),
        ],
        correctAnswerIndex: q.correctAnswerIndex as 0 | 1 | 2 | 3,
        difficulty: q.difficulty as Difficulty,
        explanation: rawEx.length > 0 ? rawEx : fallbackExplanation,
      };
    });

  const easyCount = sanitizedQuestions.filter((q) => q.difficulty === "easy").length;
  const mediumCount = sanitizedQuestions.filter((q) => q.difficulty === "medium").length;
  const hardCount = sanitizedQuestions.filter((q) => q.difficulty === "hard").length;
  const countsOk =
    sanitizedQuestions.length === 10 && easyCount === 2 && mediumCount === 4 && hardCount === 4;

  if (!countsOk) {
    return NextResponse.json(
      {
        code: QuizErrorCode.MODEL_SHAPE_INVALID,
        error: getQuizUserMessage(QuizErrorCode.MODEL_SHAPE_INVALID),
        questions: sanitizedQuestions,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ questions: sanitizedQuestions });
  } catch (error) {
    console.error("[generate-quiz] POST unhandled", error);

    return NextResponse.json(
      {
        code: QuizErrorCode.OPENAI_UNKNOWN,
        error: getQuizUserMessage(QuizErrorCode.OPENAI_UNKNOWN),
      },
      { status: 500 },
    );
  }
}
