import { useLocalSearchParams } from 'expo-router';

import { GuestMatch, HostMatch } from '@/features/match';
import { useOrientation } from '@/shared/ui/orientation';

/** Host (created the session) or guest (scanned its QR code): same screen, same code. */
export default function MatchRoute() {
  useOrientation('landscape');
  const params = useLocalSearchParams<{ role?: string; s?: string; k?: string; form?: string }>();
  if (params.role === 'guest' && params.s && params.k) {
    return <GuestMatch sessionId={params.s} sessionKey={params.k} />;
  }
  return <HostMatch sessionId={params.s ?? 'SOLO'} sessionKey={params.k} rawForm={params.form} />;
}
