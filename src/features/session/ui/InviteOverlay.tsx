import { StyleSheet, Text, View } from 'react-native';

import { buildJoinLink } from '../logic/joinLink';
import { Button } from '@/shared/ui/Button';
import { QrCode } from '@/shared/ui/QrCode';
import { colors } from '@/shared/ui/theme';

/**
 * The host's QR code, over the match: another phone scans it to join, at any time. It carries the
 * session key: only a phone that scanned it can read or change the score.
 */
export function InviteOverlay({
  sessionId,
  sessionKey,
  onClose,
}: {
  sessionId: string;
  sessionKey: string;
  onClose: () => void;
}) {
  return (
    <View style={styles.overlay}>
      <QrCode value={buildJoinLink({ sessionId, key: sessionKey })} size={240} />
      <View style={styles.text}>
        <Text style={styles.title}>Scannez pour rejoindre</Text>
        <Text style={styles.code}>Session {sessionId}</Text>
        <Text style={styles.hint}>Sur l’autre téléphone : Témoin › Rejoindre une session</Text>
        <Button label="Fermer" variant="outline" onPress={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17,17,17,0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    padding: 24,
  },
  text: { gap: 16, maxWidth: 320 },
  title: { color: colors.line, fontSize: 28, fontWeight: '800' },
  code: { color: colors.ball, fontSize: 28, fontWeight: '800', letterSpacing: 4 },
  hint: { color: colors.lineDim, fontSize: 18, textAlign: 'center' },
});
