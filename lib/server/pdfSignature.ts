/** İlk baytlar %PDF ise gerçek PDF ikilisi kabul edilir (iOS sık octet-stream gönderir). */
export function bufferHasPdfSignature(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
}
