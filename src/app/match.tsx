import { useLocalSearchParams } from 'expo-router';

import { GuestMatch, HostMatch, InvalidLink } from '@/features/match';
import { toSession } from '@/features/session';
import { useOrientation } from '@/shared/ui/orientation';

/** Host (created the session) or guest (scanned its QR code): same screen, same code. */
export default function MatchRoute() {
  useOrientation('landscape');
  const params = useLocalSearchParams<{ role?: string; s?: string; k?: string; form?: string }>();
  // The route can be opened from any temoin://match link: check it before the session starts.
  if (params.role === 'guest') {
    const join = toSession(params.s, params.k);
    if (!join) return <InvalidLink />;
    return <GuestMatch sessionId={join.sessionId} sessionKey={join.key} />;
  }
  const sessionId = params.s ?? 'SOLO';
  if (params.k !== undefined && !toSession(sessionId, params.k)) return <InvalidLink />;
  return <HostMatch sessionId={sessionId} sessionKey={params.k} rawForm={params.form} />;
}
