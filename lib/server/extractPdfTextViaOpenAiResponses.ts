import OpenAI from "openai";
import { QUIZ_UPLOAD_LIMITS } from "@/lib/quizErrors";

const OPENAI_PDF_EXTRACT_TIMEOUT_MS = 55_000;

/**
 * Yerel pdf-parse/pdfjs metin döndürmezse (taranmış PDF vb.) OpenAI Responses API
 * `input_file` ile PDF’yi modele verir; görüntü + varsa metin katmanından düz metin üretir.
 *
 * Kapatmak için: `OPENAI_PDF_VISION_EXTRACT=0`
 * Model: `OPENAI_PDF_EXTRACT_MODEL` (varsayılan `gpt-4o-mini`, yoksa `OPENAI_QUIZ_MODEL`)
 */
export async function extractPlainTextFromPdfWithOpenAi(buffer: Buffer): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return "";

  if (buffer.length > QUIZ_UPLOAD_LIMITS.maxFileBytes) {
    return "";
  }

  const model =
    process.env.OPENAI_PDF_EXTRACT_MODEL?.trim() ||
    process.env.OPENAI_QUIZ_MODEL?.trim() ||
    "gpt-4o-mini";

  const client = new OpenAI({ apiKey });
  const fileData = `data:application/pdf;base64,${buffer.toString("base64")}`;

  const response = await client.responses.create(
    {
      model,
      store: false,
      truncation: "auto",
      max_output_tokens: 8192,
      temperature: 0.1,
      instructions: [
        "Görevin: PDF içeriğinden quiz üretimine uygun düz metin çıkarmak.",
        "Yalnızca belgedeki okunabilir metni yaz: Türkçe veya belgenin dili korunsun.",
        "Markdown, kod çiti, özet veya yorum ekleme; başlık ve paragrafları düz metin olarak bırak.",
        "Hiç okunabilir metin yoksa (yalnızca boş sayfa / anlamsız gürültü) tek satır olarak tam olarak şunu yaz: NO_TEXT",
      ].join(" "),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_file",
              filename: "document.pdf",
              file_data: fileData,
            },
            {
              type: "input_text",
              text: "Bu PDF’deki tüm anlamlı ders/not metnini çıkar. Okunacak bir şey yoksa yalnızca NO_TEXT yaz.",
            },
          ],
        },
      ],
    },
    { timeout: OPENAI_PDF_EXTRACT_TIMEOUT_MS },
  );

  if (response.error) {
    console.warn("[extractPdfTextViaOpenAiResponses] response error", response.error);
    return "";
  }

  const text = (response.output_text ?? "").trim();
  if (!text || /^NO_TEXT\b/i.test(text)) {
    return "";
  }
  return text;
}
