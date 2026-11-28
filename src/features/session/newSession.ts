import { randomBytes } from '@/shared/native/random';

import { newPhrase, sessionOfPhrase } from './logic/sessionPhrase';

/**
 * A new session: its phrase (the host shows it), and the code and key worked out from it (the
 * code is advertised, the QR code carries both).
 */
export async function newSession(): Promise<{ phrase: string; sessionId: string; key: string }> {
  const phrase = newPhrase(randomBytes);
  return { phrase, ...(await sessionOfPhrase(phrase)) };
}
