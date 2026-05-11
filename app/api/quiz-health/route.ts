import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Vercel’de yapılandırma kontrolü (anahtar içeriği döndürülmez). */
export async function GET() {
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY?.trim());
  const pdfVisionExtract = process.env.OPENAI_PDF_VISION_EXTRACT !== "0";
  return NextResponse.json(
    {
      ok: true,
      hasOpenAiKey,
      pdfVisionExtract: hasOpenAiKey && pdfVisionExtract,
      node: process.version,
      hint: hasOpenAiKey
        ? pdfVisionExtract
          ? "Taranmış PDF: OPENAI_API_KEY ile sunucu okuması varsayılan açık. Kapatmak: OPENAI_PDF_VISION_EXTRACT=0."
          : "OPENAI_PDF_VISION_EXTRACT=0: sunucu PDF görüntü okuması kapalı."
        : "Vercel Environment Variables içine OPENAI_API_KEY ekleyip yeniden deploy edin.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
