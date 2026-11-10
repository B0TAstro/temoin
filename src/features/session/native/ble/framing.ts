/**
 * How a line travels over BLE: ended by a newline, cut into hex packets that fit one write or
 * notification. The line itself (a sealed message) comes from the session's codec, in
 * core/protocol: here it is just ASCII.
 */

/** Max bytes per BLE packet: fits the usual negotiated MTU (185 on iOS, 517 asked on Android). */
export const CHUNK_BYTES = 180;
/** A line never contains a raw newline (base64), so it ends a message. */
const END = '\n';

const toHex = (ascii: string) =>
  Array.from(ascii, (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');

function fromHex(hex: string): string {
  let text = '';
  for (let i = 0; i + 1 < hex.length; i += 2) {
    text += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  }
  return text;
}

/** One ASCII line as hex packets of at most CHUNK_BYTES, ready for the BLE library. */
export function encodeLine(line: string): string[] {
  const text = line + END;
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK_BYTES) {
    chunks.push(toHex(text.slice(i, i + CHUNK_BYTES)));
  }
  return chunks;
}

/**
 * Puts packets back together into lines, one decoder per sender. BLE keeps them in order; a line
 * broken by a lost packet fails the codec and is dropped, the next newline starts afresh.
 */
export class LineDecoder {
  private buffer = '';

  push(hex: string): string[] {
    this.buffer += fromHex(hex);
    const lines: string[] = [];
    let end = this.buffer.indexOf(END);
    while (end !== -1) {
      lines.push(this.buffer.slice(0, end));
      this.buffer = this.buffer.slice(end + 1);
      end = this.buffer.indexOf(END);
    }
    return lines;
  }
}
