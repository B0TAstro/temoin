import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/shared/ui/IconButton';
import { QrCode } from '@/shared/ui/QrCode';
import { ScreenTitle } from '@/shared/ui/ScreenTitle';
import { type LinkState, StatusDot } from '@/shared/ui/StatusDot';
import { colors, fonts, radius, space, type } from '@/shared/ui/theme';

import { buildJoinLink } from '../logic/joinLink';

/** The QR code on its white card: 322 in Figma, smaller on a short landscape screen */
const CARD = 322;
const SCREEN_MARGIN = 80;
const CARD_PADDING = 25;

/**
 * The host's QR code, over the match: another phone scans it to join, at any time. It carries the
 * session key (only a phone that scanned it can read or change the score) and where the host
 * listens on the Wi-Fi.
 */
export function InviteOverlay({
  sessionId,
  sessionKey,
  wifi,
  phrase,
  phones,
  link,
  onClose,
}: {
  sessionId: string;
  sessionKey: string;
  /** The host's Wi-Fi addresses (`ip:port`), empty with no Wi-Fi */
  wifi: string[];
  /** The session phrase, typed on the guest instead of scanning */
  phrase: string | undefined;
  /** Phones in the session, the host included */
  phones: number;
  link: LinkState;
  onClose: () => void;
}) {
  const { height } = useWindowDimensions();
  const card = Math.min(CARD, height - SCREEN_MARGIN);
  return (
    <SafeAreaView style={styles.overlay}>
      <View style={styles.text}>
        <IconButton icon="close" label="Fermer" variant="plain" onPress={onClose} />
        <View style={styles.body}>
          <ScreenTitle section="Session" title="Ajouter un téléphone" />
          <Text style={styles.how}>
            Sur l’autre téléphone, ouvrez Lineo, touchez « Rejoindre une session » et scannez ce
            code.
          </Text>
          {phrase !== undefined && (
            <View style={styles.phraseBlock}>
              <Text style={styles.label}>Ou saisissez la phrase</Text>
              <View style={styles.phrase}>
                <Text style={styles.phraseText} selectable>
                  {phrase}
                </Text>
              </View>
            </View>
          )}
          <View style={styles.status}>
            <StatusDot state={link} size={8} />
            <Text style={styles.statusText}>
              {phones} téléphone{phones > 1 ? 's' : ''} dans la session · en attente du suivant
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.card}>
        <QrCode
          value={buildJoinLink({ sessionId, key: sessionKey, wifi })}
          size={card - 2 * CARD_PADDING}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.bg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 36,
    gap: 48,
  },
  text: { flex: 1, maxWidth: 420, alignSelf: 'stretch', paddingTop: space.m },
  body: { paddingHorizontal: 12, paddingTop: space.l, gap: space.m },
  how: { fontFamily: fonts.light, fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.7)' },
  phraseBlock: { gap: space.s, marginTop: space.s },
  label: { ...type.section, color: colors.textDim },
  phrase: {
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: colors.card,
  },
  phraseText: {
    fontFamily: fonts.medium,
    fontSize: 22,
    letterSpacing: 2,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.s, marginTop: space.s },
  statusText: { fontFamily: fonts.light, fontSize: 13, color: colors.textDim },
  card: { backgroundColor: colors.text, borderRadius: 20, padding: CARD_PADDING },
});
