import { randomBytes } from '@/shared/native/random';

import { type Join, newSessionId, newSessionKey } from './logic/joinLink';

/** A new session: the code the host advertises, and the key its QR code carries. */
export const newSession = (): Join => ({
  sessionId: newSessionId(),
  key: newSessionKey(randomBytes),
});
