import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { randomBytes } from '@/adapters/random';
import { newSessionKey, toSession } from '@/core/protocol/joinLink';
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

function InvalidLink() {
  return (
    <MessageScreen
      message="Lien de session invalide."
      hint="Créez une session, ou scannez le QR code de l’hôte."
    >
      <Button label="Accueil" variant="outline" onPress={() => router.replace('/')} />
    </MessageScreen>
  );
}

function HostMatch({
  sessionId,
  sessionKey,
  rawForm,
}: {
  sessionId: string;
  sessionKey: string | undefined;
  rawForm: string | undefined;
}) {
  const form = useMemo(() => decodeForm(rawForm), [rawForm]);
  const key = useMemo(() => sessionKey ?? newSessionKey(randomBytes), [sessionKey]);
  const session = useHostSession(sessionId, key, form);
  if (!session.view) return null;
  return <MatchScreen session={{ ...session, view: session.view }} />;
}

function GuestMatch({ sessionId, sessionKey }: { sessionId: string; sessionKey: string }) {
  const session = useGuestSession(sessionId, sessionKey);
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
