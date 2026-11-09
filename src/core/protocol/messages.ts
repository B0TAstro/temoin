import type { LoggedEvent, MatchEvent } from '@/core/events/matchLog';

/**
 * Messages between phones. Star topology: guests only talk to the host. Never any video.
 *
 * - A guest asks for the whole log when it connects, or when it notices a missing event.
 * - The host sends every new event to all guests, and the whole log when one asks.
 */
export type GuestMessage = { t: 'intent'; event: MatchEvent } | { t: 'sync' };

export type HostMessage<Setup> =
  { t: 'snapshot'; setup: Setup; log: LoggedEvent[] } | { t: 'event'; event: LoggedEvent };

export const PROTOCOL_VERSION = 1;

/** Max bytes per BLE packet: fits the usual negotiated MTU (185 on iOS, 517 asked on Android). */
export const CHUNK_BYTES = 180;
/** JSON never contains a raw newline, so it ends a message. */
const END = '\n';

/** JSON in pure ASCII: accents become \u escapes, so one character is one byte on the wire. */
function toAscii(message: unknown): string {
  return JSON.stringify(message).replace(
    /[\u007f-￿]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

const toHex = (ascii: string) =>
  Array.from(ascii, (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');

function fromHex(hex: string): string {
  let text = '';
  for (let i = 0; i + 1 < hex.length; i += 2) {
    text += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  }
  return text;
}

/** One message as hex packets of at most CHUNK_BYTES, ready for the BLE library. */
export function encode(message: unknown): string[] {
  const text = toAscii(message) + END;
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK_BYTES) {
    chunks.push(toHex(text.slice(i, i + CHUNK_BYTES)));
  }
  return chunks;
}

/** Puts packets back together, one decoder per sender. BLE keeps them in order. */
export class Decoder<T> {
  private buffer = '';

  push(hex: string): T[] {
    this.buffer += fromHex(hex);
    const messages: T[] = [];
    let end = this.buffer.indexOf(END);
    while (end !== -1) {
      const line = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + 1);
      try {
        messages.push(JSON.parse(line) as T);
      } catch {
        // A corrupted message is dropped; the guest asks for the whole log again.
      }
      end = this.buffer.indexOf(END);
    }
    return messages;
  }
}
