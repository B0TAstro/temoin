import { PROTOCOL_VERSION } from '@/core/protocol/messages';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O: read aloud without confusion

/** A short code for the session: the host advertises it, the QR code carries it. */
export function newSessionId(): string {
  return Array.from(
    { length: 4 },
    () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)],
  ).join('');
}

export const buildJoinLink = (sessionId: string) =>
  `temoin://join?s=${sessionId}&v=${PROTOCOL_VERSION}`;

/** The session in a scanned QR code, or null if it is not a Témoin code of this version. */
export function parseJoinLink(text: string): string | null {
  const match = /^temoin:\/\/join\?s=([A-Z]{4})&v=(\d+)$/.exec(text.trim());
  if (!match?.[1] || Number(match[2]) !== PROTOCOL_VERSION) return null;
  return match[1];
}
