import { useLocalSearchParams } from 'expo-router';

import { GuestMatch, HostMatch, InvalidLink } from '@/features/match';
import { toSession } from '@/features/session';
import { useOrientation } from '@/shared/ui/orientation';

export default function MatchRoute() {
  useOrientation('landscape');
  // role 'host' | 'guest', s session code, k session key, form match settings
  const params = useLocalSearchParams<{ role?: string; s?: string; k?: string; form?: string }>();

  const session = toSession(params.s, params.k);
  if (!session) return <InvalidLink />;
  if (params.role === 'guest') {
    return <GuestMatch sessionId={session.sessionId} sessionKey={session.key} />;
  }
  if (params.role === 'host') {
    return (
      <HostMatch sessionId={session.sessionId} sessionKey={session.key} rawForm={params.form} />
    );
  }
  return <InvalidLink />;
}
