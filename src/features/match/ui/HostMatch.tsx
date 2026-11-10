import { useMemo } from 'react';

import { decodeForm, newSession, useHostSession } from '@/features/session';

import { MatchScreen } from './MatchScreen';

/** The phone that created the session: it keeps the log. Plays on its own, with or without guests. */
export function HostMatch({
  sessionId,
  sessionKey,
  rawForm,
}: {
  sessionId: string;
  sessionKey: string | undefined;
  rawForm: string | undefined;
}) {
  const form = useMemo(() => decodeForm(rawForm), [rawForm]);
  const key = useMemo(() => sessionKey ?? newSession().key, [sessionKey]);
  const session = useHostSession(sessionId, key, form);
  if (!session.view) return null;
  return <MatchScreen session={{ ...session, view: session.view }} />;
}
