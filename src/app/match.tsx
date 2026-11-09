import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { MatchScreen } from '@/features/match/MatchScreen';
import { decodeForm } from '@/features/session/setup';
import { useGuestSession } from '@/features/session/useGuestSession';
import { useHostSession } from '@/features/session/useHostSession';
import { Button } from '@/ui/Button';
import { MessageScreen } from '@/ui/MessageScreen';
import { useOrientation } from '@/ui/orientation';

/** Host (created the session) or guest (scanned its QR code): same screen, same code. */
export default function MatchRoute() {
  useOrientation('landscape');
  const params = useLocalSearchParams<{ role?: string; s?: string; form?: string }>();
  if (params.role === 'guest' && params.s) return <GuestMatch sessionId={params.s} />;
  return <HostMatch sessionId={params.s ?? 'SOLO'} rawForm={params.form} />;
}

function HostMatch({ sessionId, rawForm }: { sessionId: string; rawForm: string | undefined }) {
  const form = useMemo(() => decodeForm(rawForm), [rawForm]);
  const session = useHostSession(sessionId, form);
  if (!session.view) return null;
  return <MatchScreen session={{ ...session, view: session.view }} />;
}

function GuestMatch({ sessionId }: { sessionId: string }) {
  const session = useGuestSession(sessionId);
  if (!session.view || !session.form) {
    return (
      <MessageScreen
        message={
          session.link === 'connecting'
            ? 'Connexion à l’hôte…'
            : `Recherche de la session ${sessionId}…`
        }
        hint="Gardez les deux téléphones proches, Bluetooth activé."
      >
        <Button label="Annuler" variant="outline" onPress={() => router.replace('/')} />
      </MessageScreen>
    );
  }
  return <MatchScreen session={{ ...session, view: session.view }} />;
}
