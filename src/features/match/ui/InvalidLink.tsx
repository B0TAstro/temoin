import { router } from 'expo-router';

import { Button } from '@/shared/ui/Button';
import { MessageScreen } from '@/shared/ui/MessageScreen';

/** A temoin://match link with a malformed session code or key: back to the home screen */
export function InvalidLink() {
  return (
    <MessageScreen
      message="Lien de session invalide."
      hint="Créez une session, ou scannez le QR code de l’hôte."
    >
      <Button label="Accueil" variant="outline" onPress={() => router.replace('/')} />
    </MessageScreen>
  );
}
