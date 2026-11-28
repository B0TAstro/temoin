import { useLocalSearchParams } from 'expo-router';

import { GuestMatch, HostMatch, InvalidLink } from '@/features/match';
import { readPhrase, toSession } from '@/features/session';
import { useOrientation } from '@/shared/ui/orientation';

export default function MatchRoute() {
  useOrientation('landscape');
  // role 'host' | 'guest', s session code, k session key, w the host's Wi-Fi addresses, p the host's session phrase, form match settings
  const params = useLocalSearchParams<{
    role?: string;
    s?: string;
    k?: string;
    w?: string;
    p?: string;
    form?: string;
  }>();

  const session = toSession(params.s, params.k, params.w);
  if (!session) return <InvalidLink />;
  // Keyed by the session: other parameters on the same screen start a new session from scratch,
  // never the old one's links and key under the new code
  const identity = `${session.sessionId}:${session.key}`;
  if (params.role === 'guest') {
    return (
      <GuestMatch
        key={identity}
        sessionId={session.sessionId}
        sessionKey={session.key}
        wifi={session.wifi}
      />
    );
  }
  if (params.role === 'host') {
    return (
      <HostMatch
        key={`${identity}:${params.form ?? ''}`}
        sessionId={session.sessionId}
        sessionKey={session.key}
        phrase={readPhrase(params.p ?? '') ?? undefined}
        rawForm={params.form}
      />
    );
  }
  return <InvalidLink />;
}
