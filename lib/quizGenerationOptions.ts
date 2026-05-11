/** Sunucu + istemci: quiz üretim parametreleri (PDF route ve UI ortak) */

export type QuizDifficultyLevel = "easy" | "medium" | "hard";

export type QuizDifficultyPreset = "mixed" | QuizDifficultyLevel;

export const QUIZ_QUESTION_COUNT_DEFAULT = 10;
export const QUIZ_QUESTION_COUNT_MIN = 3;
export const QUIZ_QUESTION_COUNT_MAX = 25;

const PRESET_SET = new Set<string>(["mixed", "easy", "medium", "hard"]);

export function parseQuestionCount(value: unknown): number {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value.trim(), 10)
        : Number.NaN;
  if (!Number.isFinite(raw)) return QUIZ_QUESTION_COUNT_DEFAULT;
  const n = Math.round(raw);
  return Math.min(
    QUIZ_QUESTION_COUNT_MAX,
    Math.max(QUIZ_QUESTION_COUNT_MIN, n),
  );
}

export function parseDifficultyPreset(value: unknown): QuizDifficultyPreset {
  const s =
    typeof value === "string" ? value.trim().toLowerCase() : "";
  if (PRESET_SET.has(s)) return s as QuizDifficultyPreset;
  return "mixed";
}

/** 2:4:4 oranına yakın tam sayı dağılım (N=10 için tam 2/4/4). */
export function mixedDifficultyCounts(total: number): {
  easy: number;
  medium: number;
  hard: number;
} {
  if (total <= 0) return { easy: 0, medium: 0, hard: 0 };
  let e = Math.round((2 * total) / 10);
  let m = Math.round((4 * total) / 10);
  let h = total - e - m;
  for (let i = 0; i < 100 && e + m + h !== total; i++) {
    if (e + m + h > total) {
      if (m > 0 && m >= e) m--;
      else if (e > 0) e--;
      else if (h > 0) h--;
    } else {
      h++;
    }
  }
  return { easy: e, medium: m, hard: h };
}

export function targetCountsForPreset(
  preset: QuizDifficultyPreset,
  total: number,
): { easy: number; medium: number; hard: number } {
  if (preset === "easy") return { easy: total, medium: 0, hard: 0 };
  if (preset === "medium") return { easy: 0, medium: total, hard: 0 };
  if (preset === "hard") return { easy: 0, medium: 0, hard: total };
  return mixedDifficultyCounts(total);
}

export function buildTargetDifficultyOrder(
  preset: QuizDifficultyPreset,
  total: number,
): QuizDifficultyLevel[] {
  const t = targetCountsForPreset(preset, total);
  return [
    ...Array.from({ length: t.easy }, () => "easy" as const),
    ...Array.from({ length: t.medium }, () => "medium" as const),
    ...Array.from({ length: t.hard }, () => "hard" as const),
  ];
}

export function difficultyCounts(qs: { difficulty: QuizDifficultyLevel }[]): {
  easy: number;
  medium: number;
  hard: number;
} {
  let easy = 0;
  let medium = 0;
  let hard = 0;
  for (const q of qs) {
    if (q.difficulty === "easy") easy++;
    else if (q.difficulty === "medium") medium++;
    else hard++;
  }
  return { easy, medium, hard };
}

export function countsMatchTarget(
  qs: { difficulty: QuizDifficultyLevel }[],
  target: { easy: number; medium: number; hard: number },
): boolean {
  if (qs.length !== target.easy + target.medium + target.hard) return false;
  const c = difficultyCounts(qs);
  return (
    c.easy === target.easy &&
    c.medium === target.medium &&
    c.hard === target.hard
  );
}

export function rebalanceToTargets<T extends { difficulty: QuizDifficultyLevel }>(
  qs: T[],
  targets: QuizDifficultyLevel[],
): T[] {
  return qs.slice(0, targets.length).map((q, i) => ({
    ...q,
    difficulty: targets[i] ?? q.difficulty,
  }));
}

export function difficultyRuleForModelPrompt(
  preset: QuizDifficultyPreset,
  n: number,
): string {
  if (preset !== "mixed") {
    return `Zorluk: Tüm ${n} sorunun "difficulty" alanı tam olarak "${preset}" olmalı.`;
  }
  const t = mixedDifficultyCounts(n);
  return (
    `Zorluk dağılımı (tam olarak uygula; sıra önemli değil): ` +
    `${t.easy} soru "easy" (göreceli daha erişilebilir kavram; düz ezberden kaçın), ` +
    `${t.medium} soru "medium", ` +
    `${t.hard} soru "hard" (analiz/uygulama ağırlıklı).`
  );
}

export function verificationLineForModel(
  preset: QuizDifficultyPreset,
  n: number,
): string {
  if (preset !== "mixed") {
    return `tam ${n} soru ve her birinde difficulty yalnızca "${preset}".`;
  }
  const t = mixedDifficultyCounts(n);
  return (
    `tam ${n} soru ve difficulty sayıları: tam ${t.easy} "easy", tam ${t.medium} "medium", tam ${t.hard} "hard".`
  );
}

export function buildQuizSystemPrompt(
  questionCount: number,
  preset: QuizDifficultyPreset,
): string {
  const diffRule = difficultyRuleForModelPrompt(preset, questionCount);
  const verify = verificationLineForModel(preset, questionCount);

  return `
Rolün: Sen, yükseköğretimde uzman bir üniversite eğitmenisin.

Görev: Sana ayrı bir kullanıcı mesajı olarak gönderilen ders notu metninden yüksek kaliteli çoktan seçmeli quiz soruları üretmek.

${diffRule}

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
- Tam olarak ${questionCount} soru üret.

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
- Üretimden sonra kontrol edilecek: ${verify}
`.trim();
}

export function buildRepairSystemPrompt(
  questionCount: number,
  preset: QuizDifficultyPreset,
): string {
  const verify = verificationLineForModel(preset, questionCount);
  return [
    "Görev: Verilen quiz JSON şemasını düzelt.",
    "Çıktı: yalnızca geçerli JSON; markdown veya açıklama metni yok.",
    `Koşullar: ${verify}`,
    `Her soruda question, options (4 string), correctAnswerIndex 0-3, difficulty, explanation.`,
    "Eksik geçerli soru varsa ders içeriğine uygun üret; fazla veya geçersiz girdileri ele.",
  ].join(" ");
}
