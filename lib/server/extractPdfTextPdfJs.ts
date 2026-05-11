/**
 * pdf-parse / native katman başarısız olduğunda yedek metin çıkarımı (saf JS, Vercel uyumlu).
 */
export async function extractPdfTextWithPdfJs(buffer: Buffer): Promise<string> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(buffer);
  const loadingTask = getDocument({
    data,
    useSystemFonts: true,
    verbosity: 0,
    disableFontFace: true,
  });
  const pdf = await loadingTask.promise;
  try {
    const parts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const line = textContent.items
        .map((item) => {
          const it = item as { str?: string };
          return typeof it.str === "string" ? it.str : "";
        })
        .join(" ");
      parts.push(line);
    }
    return parts.join("\n").trim();
  } finally {
    if (typeof pdf.destroy === "function") {
      await pdf.destroy();
    }
  }
}
