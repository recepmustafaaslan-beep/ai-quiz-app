import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  getQuizUserMessage,
  QuizErrorCode,
  type QuizErrorCodeType,
  QUIZ_TEXT_LIMITS,
} from "@/lib/quizErrors";
import { mapOpenAISdkErrorToCode } from "@/lib/server/openaiQuizErrorMap";

type Difficulty = "easy" | "medium" | "hard";

type QuizQuestion = {
  question: string;
  options: [string, string, string, string];
  correctAnswerIndex: 0 | 1 | 2 | 3;
  difficulty: Difficulty;
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

export async function POST(req: Request) {
  try {
  let body: { pdfText?: string };
  try {
    body = (await req.json()) as { pdfText?: string };
  } catch {
    return jsonError(QuizErrorCode.BODY_INVALID, 400);
  }

  const pdfText = typeof body?.pdfText === "string" ? body.pdfText.trim() : "";

  if (!pdfText) {
    return jsonError(QuizErrorCode.PDF_EMPTY, 400);
  }

  if (pdfText.length < QUIZ_TEXT_LIMITS.minChars) {
    return jsonError(QuizErrorCode.PDF_TEXT_TOO_SHORT, 400);
  }

  if (pdfText.length > QUIZ_TEXT_LIMITS.maxChars) {
    return jsonError(QuizErrorCode.QUIZ_TEXT_TOO_LONG, 400);
  }

  if (!process.env.OPENAI_API_KEY) {
    return jsonError(QuizErrorCode.SERVER_CONFIG, 500);
  }

  const prompt = `
Rolün: Sen, yükseköğretimde uzman bir üniversite eğitmenisin.

Görev: Aşağıdaki ders notu metninden yüksek kaliteli çoktan seçmeli quiz soruları üretmek.

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

Çıktı biçimi:
- Yalnızca geçerli JSON dön; markdown, açıklama, ek metin yok.
- Tam olarak 10 soru üret.

JSON şablonu (birebir anahtarlar):
{
  "questions": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctAnswerIndex": 0,
      "difficulty": "easy"
    }
  ]
}

Kurallar:
- correctAnswerIndex yalnızca 0, 1, 2 veya 3 olabilir.
- difficulty yalnızca "easy", "medium" veya "hard" olabilir.

Ders notu metni:
${pdfText}
`;

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
            content:
              "Yanıtın yalnızca geçerli JSON olmalıdır; markdown, kod bloğu veya açıklama metni ekleme.",
          },
          {
            role: "user",
            content: prompt,
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
    .map((q) => ({
      question: q.question,
      options: [
        String(q.options[0]),
        String(q.options[1]),
        String(q.options[2]),
        String(q.options[3]),
      ],
      correctAnswerIndex: q.correctAnswerIndex as 0 | 1 | 2 | 3,
      difficulty: q.difficulty as Difficulty,
    }));

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
    console.error("[generate-quiz]", error);
    return jsonError(QuizErrorCode.OPENAI_UNKNOWN, 500);
  }
}
