/** Model bağlamı için PDF/metin üst sınırı — çıktı token'ı için yer bırakır */
const DEFAULT_MAX = 32_000;

export function truncateQuizSourceText(text: string, maxChars = DEFAULT_MAX): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[Not: Kaynak metin uzun olduğu için burada kesildi; sorular yalnızca bu bölümden üretilmelidir.]`;
}
