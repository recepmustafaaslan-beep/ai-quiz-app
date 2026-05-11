/**
 * Vercel / Node ortamında pdf.js’in CMap ve standart font dosyalarını bulabilmesi için CDN tabanı.
 * pdf-parse kendi pdfjs sürümünü kullanır — asset sürümü onunla eşleşmeli.
 */
export const PDFJS_PDF_PARSE_PEER_VERSION = "5.4.296";

/** Doğrudan `import("pdfjs-dist/...")` ile gelen kök bağımlılık sürümü */
export const PDFJS_ROOT_VERSION = "5.7.284";

export type PdfJsServerAssetFields = {
  cMapUrl: string;
  cMapPacked: boolean;
  standardFontDataUrl: string;
  wasmUrl: string;
  useWorkerFetch: boolean;
  useSystemFonts: boolean;
  verbosity: 0;
  disableFontFace: boolean;
};

export function getPdfJsServerAssetFields(
  distVersion: string,
  opts?: { disableFontFace?: boolean },
): PdfJsServerAssetFields {
  const base = `https://unpkg.com/pdfjs-dist@${distVersion}/`;
  return {
    cMapUrl: `${base}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base}standard_fonts/`,
    wasmUrl: `${base}wasm/`,
    useWorkerFetch: false,
    useSystemFonts: true,
    verbosity: 0,
    disableFontFace: opts?.disableFontFace ?? false,
  };
}
