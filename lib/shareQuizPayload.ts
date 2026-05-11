/**
 * Quiz paylaşım linki: gzip + base64url (CompressionStream).
 * Destek yoksa sıkıştırmasız yedek (0.) kullanılır.
 */

export type ShareQuizPayloadV1 = {
  v: 1;
  questions: Array<{
    question: string;
    options: [string, string, string, string];
    correctAnswerIndex: 0 | 1 | 2 | 3;
    difficulty: "easy" | "medium" | "hard";
    explanation: string;
  }>;
  result?: {
    score: number;
    total: number;
    points: number;
    maxPoints: number;
  };
};

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function base64UrlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  const padded = pad ? b64 + "=".repeat(4 - pad) : b64;
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function isDifficulty(d: unknown): d is "easy" | "medium" | "hard" {
  return d === "easy" || d === "medium" || d === "hard";
}

function validatePayload(raw: unknown): ShareQuizPayloadV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return null;
  if (!Array.isArray(o.questions) || o.questions.length === 0 || o.questions.length > 50) return null;

  const questions: ShareQuizPayloadV1["questions"] = [];
  for (const item of o.questions) {
    if (!item || typeof item !== "object") return null;
    const q = item as Record<string, unknown>;
    if (typeof q.question !== "string" || q.question.length > 5000) return null;
    if (!Array.isArray(q.options) || q.options.length !== 4) return null;
    const opts = q.options.map((x) => String(x)) as [string, string, string, string];
    if (![0, 1, 2, 3].includes(q.correctAnswerIndex as number)) return null;
    if (!isDifficulty(q.difficulty)) return null;
    const explanation = typeof q.explanation === "string" ? q.explanation : "";
    questions.push({
      question: q.question,
      options: opts,
      correctAnswerIndex: q.correctAnswerIndex as 0 | 1 | 2 | 3,
      difficulty: q.difficulty,
      explanation: explanation.slice(0, 8000),
    });
  }

  let result: ShareQuizPayloadV1["result"];
  if (o.result && typeof o.result === "object") {
    const r = o.result as Record<string, unknown>;
    if (
      typeof r.score === "number" &&
      typeof r.total === "number" &&
      typeof r.points === "number" &&
      typeof r.maxPoints === "number"
    ) {
      result = {
        score: Math.max(0, Math.floor(r.score)),
        total: Math.max(1, Math.floor(r.total)),
        points: Math.max(0, Math.floor(r.points)),
        maxPoints: Math.max(1, Math.floor(r.maxPoints)),
      };
    }
  }

  return { v: 1, questions, result };
}

/**
 * Paylaşım linki üretimi (sıkıştırmasız, senkron).
 * Tarayıcıda panoya kopyalama tıklama hareketinde kalmak için `await` içermez.
 */
export function encodeSharePayloadSync(payload: ShareQuizPayloadV1): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  return `0.${base64UrlEncode(bytes)}`;
}

export async function encodeSharePayload(payload: ShareQuizPayloadV1): Promise<string> {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);

  if (typeof CompressionStream !== "undefined") {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
      const buf = await new Response(stream).arrayBuffer();
      const gz = new Uint8Array(buf);
      return `1.${base64UrlEncode(gz)}`;
    } catch {
      /* yedek */
    }
  }
  return `0.${base64UrlEncode(bytes)}`;
}

export async function decodeSharePayload(encoded: string): Promise<
  { ok: true; payload: ShareQuizPayloadV1 } | { ok: false; error: string }
> {
  const trimmed = encoded.trim();
  if (!trimmed) return { ok: false, error: "Paylaşım kodu boş." };

  const dot = trimmed.indexOf(".");
  if (dot < 1) return { ok: false, error: "Geçersiz paylaşım biçimi." };

  const flag = trimmed.slice(0, dot);
  const data = trimmed.slice(dot + 1);
  let jsonBytes: Uint8Array;

  try {
    const raw = base64UrlDecode(data);
    if (flag === "1") {
      if (typeof DecompressionStream === "undefined") {
        return { ok: false, error: "Bu tarayıcı sıkıştırılmış paylaşımı açamıyor." };
      }
      const stream = new Blob([new Uint8Array(raw)]).stream().pipeThrough(new DecompressionStream("gzip"));
      const out = await new Response(stream).arrayBuffer();
      jsonBytes = new Uint8Array(out);
    } else if (flag === "0") {
      jsonBytes = raw;
    } else {
      return { ok: false, error: "Bilinmeyen paylaşım sürümü." };
    }
  } catch {
    return { ok: false, error: "Paylaşım verisi okunamadı." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(jsonBytes));
  } catch {
    return { ok: false, error: "Paylaşım içeriği çözülemedi." };
  }

  const payload = validatePayload(parsed);
  if (!payload) return { ok: false, error: "Quiz verisi geçersiz veya eksik." };

  return { ok: true, payload };
}

export function buildPaylasUrl(origin: string, encodedToken: string): string {
  const path = "/paylas";
  return `${origin.replace(/\/$/u, "")}${path}?d=${encodeURIComponent(encodedToken)}`;
}
