import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Vercel’de yapılandırma kontrolü (anahtar içeriği döndürülmez). */
export async function GET() {
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY?.trim());
  return NextResponse.json(
    {
      ok: true,
      hasOpenAiKey,
      node: process.version,
      hint: hasOpenAiKey
        ? "OPENAI_API_KEY tanımlı görünüyor."
        : "Vercel Environment Variables içine OPENAI_API_KEY ekleyip yeniden deploy edin.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
