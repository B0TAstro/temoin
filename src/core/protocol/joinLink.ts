import { fromBase64Url, toBase64Url } from './base64url';
import { PROTOCOL_VERSION } from './messages';
import { KEY_BYTES } from './SealedCodec';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O: read aloud without confusion

/** What a guest needs to join: the session to look for, and the key to talk to it. */
export type Join = { sessionId: string; key: string };

/** A short code for the session: the host advertises it, the QR code carries it. */
export function newSessionId(): string {
  return Array.from(
    { length: 4 },
    () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)],
  ).join('');
}

/** The session key, as text for the QR code and the route. */
export const newSessionKey = (randomBytes: (count: number) => Uint8Array) =>
  toBase64Url(randomBytes(KEY_BYTES));

/** The key as bytes, or null if it is not a key. */
export function decodeSessionKey(key: string): Uint8Array | null {
  const bytes = fromBase64Url(key);
  return bytes?.length === KEY_BYTES ? bytes : null;
}

export const buildJoinLink = ({ sessionId, key }: Join) =>
  `temoin://join?s=${sessionId}&k=${key}&v=${PROTOCOL_VERSION}`;

/** The session code and its key, or null if either is malformed (a hand-made link, say). */
export function toSession(s: string | undefined, k: string | undefined): Join | null {
  if (!s || !/^[A-Z]{4}$/.test(s) || !k || !decodeSessionKey(k)) return null;
  return { sessionId: s, key: k };
}

/**
 * The session in the link's parameters (scanned in the app, or opened from the iPhone Camera
 * app), or null if it is not a Témoin link of this version.
 */
export function toJoin(params: { s?: string; k?: string; v?: string }): Join | null {
  if (Number(params.v) !== PROTOCOL_VERSION) return null;
  return toSession(params.s, params.k);
}

export function parseJoinLink(text: string): Join | null {
  const match = /^temoin:\/\/join\?s=([^&]*)&k=([^&]*)&v=(\d+)$/.exec(text.trim());
  if (!match) return null;
  return toJoin({ s: match[1] ?? '', k: match[2] ?? '', v: match[3] ?? '' });
}
