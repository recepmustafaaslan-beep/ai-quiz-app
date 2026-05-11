/**
 * Model çoğu kez correctAnswerIndex=0 üretir; şıkları permüte ederek
 * A/B/C/D konumlarında doğru cevabı mümkün olduğunca eşit dağıtır.
 */

export type FourOptionQuestion = {
  options: [string, string, string, string];
  correctAnswerIndex: 0 | 1 | 2 | 3;
};

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = t;
  }
}

/** n soru için her 0..3 indeksinden mümkün olduğunca eşit sayıda hedef üretir (karışık sıra). */
export function balancedCorrectIndexOrder(n: number): (0 | 1 | 2 | 3)[] {
  if (n <= 0) return [];
  const q = Math.floor(n / 4);
  const r = n % 4;
  const slots: (0 | 1 | 2 | 3)[] = [];
  for (let i = 0; i < 4; i++) {
    const c = q + (i < r ? 1 : 0);
    for (let j = 0; j < c; j++) slots.push(i as 0 | 1 | 2 | 3);
  }
  shuffleInPlace(slots);
  return slots;
}

function permuteOptionsToMoveCorrect(
  options: [string, string, string, string],
  from: 0 | 1 | 2 | 3,
  to: 0 | 1 | 2 | 3,
): [string, string, string, string] {
  if (from === to) return options;
  const correctText = options[from];
  const others = ([0, 1, 2, 3] as const)
    .filter((i) => i !== from)
    .map((i) => options[i]);
  const out: [string, string, string, string] = ["", "", "", ""];
  out[to] = correctText;
  let p = 0;
  for (let pos = 0; pos < 4; pos++) {
    if (pos === to) continue;
    out[pos] = others[p]!;
    p += 1;
  }
  return out;
}

export function equalizeCorrectAnswerIndices<T extends FourOptionQuestion>(questions: T[]): T[] {
  if (questions.length === 0) return questions;
  const targets = balancedCorrectIndexOrder(questions.length);
  return questions.map((q, i) => {
    const from = q.correctAnswerIndex;
    const to = targets[i] ?? from;
    const newOpts = permuteOptionsToMoveCorrect(q.options, from, to);
    return { ...q, options: newOpts, correctAnswerIndex: to };
  });
}
