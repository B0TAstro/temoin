import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';

import { toBase64Url } from '@/shared/lib/base64url';

import { SESSION_ID_ALPHABET, SESSION_ID_LENGTH } from './joinLink';
import { KEY_BYTES } from './SealedCodec';

/** Crockford's base32: digits and capitals, without I, L, O, U (read aloud or typed, no mix-up) */
const SYMBOLS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const GROUPS = 3;
const GROUP_LENGTH = 4;
const PHRASE_LENGTH = GROUPS * GROUP_LENGTH;
/**
 * Slows down every guess at the phrase (60 bits) for someone who caught a sealed message. Run
 * once per phone, at creation or when typed: about a fraction of a second on a phone.
 */
const KEY_ITERATIONS = 20_000;

/** A new phrase: 12 random symbols (60 bits), in 3 groups: `XE56-JFHF-K3QB` */
export function newPhrase(randomBytes: (count: number) => Uint8Array): string {
  // 256 is a multiple of 32: the low 5 bits of a random byte are an even pick among the symbols
  const symbols = Array.from(randomBytes(PHRASE_LENGTH), (byte) => SYMBOLS[byte % 32] ?? '0');
  return group(symbols.join(''));
}

/**
 * The phrase as typed, in its one written form, or null if it is not one. Forgiving: any case,
 * spaces and dashes anywhere, O read as 0, I and L as 1.
 */
export function readPhrase(text: string): string | null {
  const symbols = text.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (symbols.length !== PHRASE_LENGTH) return null;
  if ([...symbols].some((symbol) => !SYMBOLS.includes(symbol))) return null;
  return group(symbols);
}

/**
 * The session the phrase stands for. The phrase is the session's secret: its code (public, in
 * the Bluetooth name) and its key (never sent) are worked out from it, so typing it on another
 * phone gives the same session without anything sent over the radio. The QR code carries the
 * code and the key themselves.
 */
export async function sessionOfPhrase(phrase: string): Promise<{ sessionId: string; key: string }> {
  const digest = sha256(utf8ToBytes(`lineo-id:${phrase}`));
  const sessionId = Array.from(
    digest.slice(0, SESSION_ID_LENGTH),
    (byte) => SESSION_ID_ALPHABET[byte % SESSION_ID_ALPHABET.length] ?? 'A',
  ).join('');
  const key = await pbkdf2Async(sha256, utf8ToBytes(phrase), utf8ToBytes('lineo-key'), {
    c: KEY_ITERATIONS,
    dkLen: KEY_BYTES,
  });
  return { sessionId, key: toBase64Url(key) };
}

const group = (symbols: string) =>
  Array.from({ length: GROUPS }, (_, i) =>
    symbols.slice(i * GROUP_LENGTH, (i + 1) * GROUP_LENGTH),
  ).join('-');
