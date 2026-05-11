import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Vercel’de yapılandırma kontrolü (anahtar içeriği döndürülmez). */
export async function GET() {
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY?.trim());
  const pdfVisionExtract = process.env.OPENAI_PDF_VISION_EXTRACT === "1";
  return NextResponse.json(
    {
      ok: true,
      hasOpenAiKey,
      pdfVisionExtract,
      node: process.version,
      hint: hasOpenAiKey
        ? pdfVisionExtract
          ? "OPENAI_PDF_VISION_EXTRACT=1: taranmış PDF için ek OpenAI adımı açık (daha yavaş ve pahalı)."
          : "OPENAI_API_KEY tanımlı. Taranmış PDF için isteğe bağlı: OPENAI_PDF_VISION_EXTRACT=1."
        : "Vercel Environment Variables içine OPENAI_API_KEY ekleyip yeniden deploy edin.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
