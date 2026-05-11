import { Buffer } from "node:buffer";

/**
 * Reads an uploaded `File` as a Node `Buffer`.
 * Tries `arrayBuffer()` first; on failure (some mobile / WebView edge cases), falls back to `stream()`.
 */
export async function readUploadFileBuffer(file: File): Promise<
  { ok: true; buffer: Buffer } | { ok: false; reason: "empty" | "read_failed" }
> {
  try {
    const ab = await file.arrayBuffer();
    if (!ab || ab.byteLength === 0) {
      return { ok: false, reason: "empty" };
    }
    return { ok: true, buffer: Buffer.from(ab) };
  } catch (first) {
    console.warn("[readUploadFileBuffer] arrayBuffer failed, using stream fallback", first);
  }

  try {
    const stream = file.stream();
    const reader = stream.getReader();
    const chunks: Buffer[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value?.byteLength) {
        chunks.push(Buffer.from(value));
      }
    }
    if (chunks.length === 0) {
      return { ok: false, reason: "empty" };
    }
    return { ok: true, buffer: Buffer.concat(chunks) };
  } catch (second) {
    console.error("[readUploadFileBuffer] stream read failed", second);
    return { ok: false, reason: "read_failed" };
  }
}
