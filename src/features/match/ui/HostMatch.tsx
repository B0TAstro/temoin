import { useMemo } from 'react';

import { decodeForm, useHostSession } from '@/features/session';

import { MatchScreen } from './MatchScreen';

/** The phone that created the session: it keeps the log. Plays on its own, with or without guests */
export function HostMatch({
  sessionId,
  sessionKey,
  rawForm,
}: {
  sessionId: string;
  sessionKey: string;
  rawForm: string | undefined;
}) {
  // Same object while the text is the same, a new one would restart the session
  const form = useMemo(() => decodeForm(rawForm), [rawForm]);
  return <MatchScreen session={useHostSession(sessionId, sessionKey, form)} />;
}
