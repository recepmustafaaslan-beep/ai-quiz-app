/**
 * PDF'den çıkarılan ham metni yapay zekâya göndermeden önce temizler.
 */

const PAGE_NUMBER_PATTERNS: RegExp[] = [
  /^\d{1,4}$/,
  /^(page|sayfa|p\.?)\s*\d+(\s*(of|\/|\/\s*)\s*\d+)?$/i,
  /^\d{1,3}\s*\/\s*\d{1,3}$/,
  /^-\s*\d{1,4}\s*-$/,
  /^\[\s*\d{1,4}\s*\]$/,
  /^[ivxlcdm]{1,8}$/i,
];

function isPageNumberLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (PAGE_NUMBER_PATTERNS.some((re) => re.test(t))) return true;
  if (/^\d{1,4}\s*[-–—]\s*\d{1,4}$/.test(t)) return true;
  return false;
}

/** Yalnızca URL, e-posta veya dosya adı gibi tekrarlayan alt bilgi satırları */
function isLikelyFooterOrHeaderLine(line: string): boolean {
  const t = line.trim();
  if (t.length === 0) return true;
  if (t.length <= 2) return true;
  if (/^https?:\/\/\S+$/i.test(t)) return true;
  if (/^www\.\S+$/i.test(t)) return true;
  if (/^\S+@\S+\.\S+$/.test(t)) return true;
  if (/^confidential|gizli|taslak|draft$/i.test(t)) return true;
  if (t.length <= 40 && /^[A-Z0-9\s\-–—.:]+$/.test(t) && /[A-Z]/.test(t) && !/[.!?]/.test(t)) {
    return true;
  }
  return false;
}

function stripControlAndNoiseChars(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u00AD\uFEFF]/g, " ")
    .replace(/[\u200B-\u200D\u2060]/g, "");
}

function normalizeLine(line: string): string {
  return line
    .replace(/[\t\u00A0]+/g, " ")
    .replace(/[ \u3000]+/g, " ")
    .trim();
}

function splitNonEmptyLines(text: string): string[] {
  return text
    .split("\n")
    .map(normalizeLine)
    .filter((l) => l.length > 0);
}

function dedupeConsecutiveLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    if (out.length === 0 || out[out.length - 1] !== line) {
      out.push(line);
    }
  }
  return out;
}

/** Çok sayfada tekrarlanan kısa satırları (başlık/alt bilgi) kaldırır */
function removeHighFrequencyShortLines(lines: string[], minRepeats: number): string[] {
  if (lines.length === 0) return lines;
  const key = (s: string) => s.toLowerCase().replace(/\s+/g, " ");
  const counts = new Map<string, number>();
  for (const line of lines) {
    if (line.length > 120) continue;
    const k = key(line);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const dropKeys = new Set<string>();
  for (const [k, n] of counts) {
    if (n >= minRepeats && k.length <= 100) {
      dropKeys.add(k);
    }
  }
  return lines.filter((line) => {
    if (line.length > 120) return true;
    const k = key(line);
    return !dropKeys.has(k);
  });
}

/** Tek sayfa: üst/alt satırlarda sayfa numarası ve tipik üst/alt bilgi */
function preprocessSinglePage(pageText: string): string {
  let lines = splitNonEmptyLines(stripControlAndNoiseChars(pageText));
  if (lines.length === 0) return "";

  const stripEnds = (arr: string[]) => {
    let a = [...arr];
    while (a.length > 0 && (isPageNumberLine(a[0]) || isLikelyFooterOrHeaderLine(a[0]))) {
      a.shift();
    }
    while (a.length > 0 && (isPageNumberLine(a[a.length - 1]) || isLikelyFooterOrHeaderLine(a[a.length - 1]))) {
      a.pop();
    }
    return a;
  };

  lines = stripEnds(lines);
  lines = lines.filter((l) => !isPageNumberLine(l));
  return lines.join("\n");
}

/**
 * Sayfa bazlı metinleri birleştirip genel temizlik uygular.
 */
export function preprocessPdfPages(pageTexts: string[]): string {
  const cleanedPages = pageTexts.map(preprocessSinglePage).filter((p) => p.length > 0);
  let body = cleanedPages.join("\n");

  body = stripControlAndNoiseChars(body);
  let lines = splitNonEmptyLines(body);
  lines = lines.filter((l) => !isPageNumberLine(l));
  lines = dedupeConsecutiveLines(lines);

  const minRepeats = Math.max(4, Math.ceil(lines.length / 25));
  lines = removeHighFrequencyShortLines(lines, minRepeats);

  let joined = lines.join("\n");
  joined = joined.replace(/\n{3,}/g, "\n\n");

  return joined.trim();
}

/**
 * Ham PDF birleştirme çıktısı (sayfa ayrımı olmadan) için.
 */
export function preprocessPdfText(raw: string): string {
  const normalized = stripControlAndNoiseChars(raw).trim();
  if (!normalized) return "";
  return preprocessPdfPages([normalized]);
}
