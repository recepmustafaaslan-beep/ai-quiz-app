import { preprocessPdfText } from "@/lib/preprocessPdfText";
import {
  getQuizUserMessage,
  QuizErrorCode,
  type QuizErrorCodeType,
  QUIZ_TEXT_LIMITS,
  QUIZ_UPLOAD_LIMITS,
  isLikelyInvalidPdfError,
} from "@/lib/quizErrors";
import { extractPdfTextWithPdfParse } from "@/lib/server/pdfParseExtract";
import { bufferHasPdfSignature } from "@/lib/server/pdfSignature";

export const runtime = "nodejs";

export const maxDuration = 60;

/** pdf-parse v2; eski v1 `pdf(buffer)` imzasına yakın kullanım */
async function pdf(buffer: Buffer): Promise<{ text: string }> {
  const text = await extractPdfTextWithPdfParse(buffer);
  return { text };
}

function jsonError(code: QuizErrorCodeType, status: number) {
  return Response.json({ code, error: getQuizUserMessage(code) }, { status });
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return jsonError(QuizErrorCode.BODY_INVALID, 400);
    }

    const pdfFile = file as File;

    if (pdfFile.size === 0) {
      return jsonError(QuizErrorCode.FILE_EMPTY, 400);
    }

    if (pdfFile.size > QUIZ_UPLOAD_LIMITS.maxFileBytes) {
      return jsonError(QuizErrorCode.PDF_TOO_LARGE, 400);
    }

    const name = pdfFile.name?.toLowerCase() ?? "";
    const type = pdfFile.type;

    const buffer = Buffer.from(await pdfFile.arrayBuffer());

    const pdfSig = bufferHasPdfSignature(buffer);
    const mime = (type || "").toLowerCase();
    const clearlyWrongMedia =
      mime.startsWith("image/") || mime.startsWith("video/") || mime.startsWith("audio/");
    if (clearlyWrongMedia && !pdfSig) {
      return jsonError(QuizErrorCode.PDF_INVALID, 400);
    }
    if (!pdfSig && mime && !/^application\/(pdf|octet-stream|x-pdf)$/i.test(mime) && !name.endsWith(".pdf")) {
      return jsonError(QuizErrorCode.PDF_INVALID, 400);
    }

    let data: { text: string };
    try {
      data = await pdf(buffer);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const code = isLikelyInvalidPdfError(msg) ? QuizErrorCode.PDF_INVALID : QuizErrorCode.PDF_READ_FAILED;
      return jsonError(code, 400);
    }

    const text = data.text;

    if (!text) {
      return Response.json({ error: "PDF okunamadı" }, { status: 400 });
    }

    const processed = preprocessPdfText(text);

    if (!processed.trim()) {
      return Response.json({ error: "PDF okunamadı" }, { status: 400 });
    }

    if (processed.length < QUIZ_TEXT_LIMITS.minChars) {
      return jsonError(QuizErrorCode.PDF_TEXT_TOO_SHORT, 400);
    }

    if (processed.length > QUIZ_TEXT_LIMITS.maxChars) {
      return jsonError(QuizErrorCode.QUIZ_TEXT_TOO_LONG, 400);
    }

    return Response.json({ text: processed });
  } catch (error) {
    console.error("[extract-pdf]", error);
    return jsonError(QuizErrorCode.CLIENT_UNEXPECTED, 500);
  }
}
