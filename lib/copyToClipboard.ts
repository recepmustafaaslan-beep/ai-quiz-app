/**
 * Tıklama işleyicisi içinde senkron çalışır; `await` sonrası kaybolan pano izni sorununu aşar.
 * Önce `execCommand`, gerekirse `navigator.clipboard` (secure context).
 */
export function copyTextToClipboardSync(text: string): boolean {
  if (typeof document === "undefined") return false;

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.width = "2em";
    ta.style.height = "2em";
    ta.style.padding = "0";
    ta.style.border = "none";
    ta.style.outline = "none";
    ta.style.boxShadow = "none";
    ta.style.background = "transparent";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    ta.setAttribute("aria-hidden", "true");
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) return true;
  } catch {
    /* devam */
  }

  return false;
}
