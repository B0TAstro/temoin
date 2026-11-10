const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const INDEX = new Map(Array.from(ALPHABET, (c, i) => [c, i]));

/**
 * Bytes as URL-safe base64, without padding: safe in a QR code link, and plain ASCII with no
 * newline on the wire. Written here rather than relying on atob/btoa, which not every JS engine
 * of React Native provides.
 */
export function toBase64Url(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a = 0, b = 0, c = 0] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    const n = (a << 16) | (b << 8) | c;
    const left = bytes.length - i;
    text += ALPHABET[(n >> 18) & 63];
    text += ALPHABET[(n >> 12) & 63];
    if (left > 1) text += ALPHABET[(n >> 6) & 63];
    if (left > 2) text += ALPHABET[n & 63];
  }
  return text;
}

/** Null when the text is not URL-safe base64. */
export function fromBase64Url(text: string): Uint8Array | null {
  if (text.length % 4 === 1) return null;
  const bytes = new Uint8Array(Math.floor((text.length * 3) / 4));
  let bits = 0;
  let value = 0;
  let out = 0;
  for (const c of text) {
    const digit = INDEX.get(c);
    if (digit === undefined) return null;
    value = (value << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[out++] = (value >> bits) & 0xff;
    }
  }
  return bytes;
}
