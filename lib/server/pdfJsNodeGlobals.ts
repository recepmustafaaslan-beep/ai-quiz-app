/**
 * pdfjs-dist/legacy/build/pdf.mjs modülü yüklenirken `new DOMMatrix()` çalışır;
 * Node'da global yoksa ReferenceError. pdf.js, @napi-rs/canvas üzerinden polyfill bekler —
 * paket kökte olmalı ve import ÖNCE yapılmalı (pdf-parse içindeki nested sürüm yeterli olmayabilir).
 */
let installPromise: Promise<boolean> | null = null;

export function installPdfJsNodeGlobals(): Promise<boolean> {
  if (typeof globalThis.DOMMatrix !== "undefined") {
    return Promise.resolve(true);
  }
  if (!installPromise) {
    installPromise = (async () => {
      try {
        const canvas = await import("@napi-rs/canvas");
        const w = globalThis as unknown as Record<string, unknown>;
        if (typeof globalThis.DOMMatrix === "undefined" && canvas.DOMMatrix) {
          w.DOMMatrix = canvas.DOMMatrix;
        }
        if (typeof globalThis.ImageData === "undefined" && canvas.ImageData) {
          w.ImageData = canvas.ImageData;
        }
        if (typeof globalThis.Path2D === "undefined" && canvas.Path2D) {
          w.Path2D = canvas.Path2D;
        }
        return typeof globalThis.DOMMatrix !== "undefined";
      } catch (e) {
        console.warn("[pdfJsNodeGlobals] @napi-rs/canvas yüklenemedi", e);
        return false;
      }
    })();
  }
  return installPromise;
}
