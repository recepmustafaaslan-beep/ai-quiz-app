/**
 * Model bazen markdown çiti veya ön/arka gürültü ile JSON döndürür; sunucu tarafında gevşek ayrıştırma.
 */

function stripBom(s: string): string {
  if (s.length > 0 && s.charCodeAt(0) === 0xfeff) return s.slice(1);
  return s;
}

function parseObject(candidate: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(candidate) as unknown;
    if (v === null || typeof v !== "object" || Array.isArray(v)) return null;
    return v as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Model çıktısından `questions` dizisi içeren kök nesneyi yakalar */
export function tryParseQuizModelJson(raw: string): { questions: unknown[] } | null {
  const s = stripBom(raw).trim();
  if (!s) return null;

  const direct = parseObject(s);
  if (direct && Array.isArray(direct.questions)) {
    return { questions: direct.questions };
  }

  const fence = s.indexOf("```");
  if (fence >= 0) {
    const inner = s.slice(fence + 3).replace(/^\s*json\s*/i, "").trimStart();
    const close = inner.indexOf("```");
    if (close >= 0) {
      const fenced = parseObject(inner.slice(0, close).trim());
      if (fenced && Array.isArray(fenced.questions)) {
        return { questions: fenced.questions };
      }
    }
  }

  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const sliced = parseObject(s.slice(start, end + 1));
    if (sliced && Array.isArray(sliced.questions)) {
      return { questions: sliced.questions };
    }
  }

  return null;
}
