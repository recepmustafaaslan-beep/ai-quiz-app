/**
 * pdf.js `getDocument({ data })` TypedArray'i worker'a transfer edebilir; paylaşılan Buffer
 * görünümünü bozmamak için her kullanımda ayrı kopya üretilir.
 */
export function pdfBufferToUint8Array(buffer: Buffer): Uint8Array {
  const out = new Uint8Array(buffer.length);
  out.set(buffer);
  return out;
}
