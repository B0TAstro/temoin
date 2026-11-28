import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, useCameraPermission } from 'react-native-vision-camera';

import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import { ScreenTitle } from '@/shared/ui/ScreenTitle';
import { TextField } from '@/shared/ui/TextField';
import { colors, fonts, radiusCard, space, type } from '@/shared/ui/theme';

import ScanCorner from '../../../../assets/images/scan-corner.svg';
import { useGuestJoin } from '../useGuestJoin';
import { usePhraseJoin } from '../usePhraseJoin';
import { useQrJoin } from '../useQrJoin';

/**
 * Joining a session (design.md §5.3): the host's QR code, or its phrase. Also reached through
 * the lineo://join link
 */
export function JoinSessionScreen() {
  const join = useGuestJoin();
  const qr = useQrJoin(join);
  const byPhrase = usePhraseJoin(join);
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();

  useEffect(() => {
    if (!hasPermission && canRequestPermission) requestPermission();
  }, [hasPermission, canRequestPermission, requestPermission]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <IconButton icon="close" label="Fermer" variant="plain" onPress={() => router.back()} />
      </View>
      <View style={styles.content}>
        <ScreenTitle section="Session" title="Rejoindre" />

        <View style={styles.scanner}>
          {hasPermission ? (
            <Camera
              style={StyleSheet.absoluteFill}
              device="back"
              isActive
              outputs={[qr.scanner]}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholder}>
              <Icon name="qr" size={36} color={colors.textSoft} />
              <Text style={styles.aim}>Visez le QR code du téléphone hôte</Text>
            </View>
          )}
          {CORNERS.map((corner) => (
            <View key={corner.rotate} style={[styles.corner, corner.place]}>
              <ScanCorner style={{ transform: [{ rotate: corner.rotate }] }} />
            </View>
          ))}
        </View>

        {qr.invalid && <Text style={styles.invalid}>Ce n’est pas un code de session Lineo.</Text>}

        <View style={styles.field}>
          <Text style={styles.label}>Ou saisissez la phrase de session</Text>
          <TextField
            value={byPhrase.phrase}
            onChangeText={byPhrase.setPhrase}
            placeholder="XE56-JFHF-K3QB"
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Text style={styles.hint}>
            {byPhrase.phrase.length > 0 && !byPhrase.complete
              ? 'Phrase incomplète : 3 groupes de 4 caractères.'
              : 'La phrase s’affiche sous le QR code, sur le téléphone hôte.'}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          label={byPhrase.joining ? '…' : 'Rejoindre'}
          disabled={!byPhrase.complete || byPhrase.joining}
          onPress={byPhrase.submit}
        />
      </View>
    </SafeAreaView>
  );
}

/** The same lemon corner, turned for each corner of the viewfinder (Figma) */
const CORNERS = [
  { rotate: '0deg', place: { top: 39, left: 47 } },
  { rotate: '90deg', place: { top: 39, right: 47 } },
  { rotate: '180deg', place: { bottom: 39, right: 47 } },
  { rotate: '270deg', place: { bottom: 39, left: 47 } },
] as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', paddingHorizontal: 12 },
  content: { flex: 1, paddingHorizontal: space.l, paddingTop: space.l, gap: space.l },
  scanner: {
    height: 320,
    borderRadius: radiusCard,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22 },
  aim: { fontFamily: fonts.light, fontSize: 16, color: 'rgba(255,255,255,0.8)' },
  corner: { position: 'absolute' },
  invalid: { fontFamily: fonts.light, fontSize: 15, color: colors.text },
  field: { gap: 12 },
  label: { ...type.section, color: colors.textDim },
  hint: { fontFamily: fonts.light, fontSize: 14, lineHeight: 21, color: colors.textSoft },
  footer: { paddingHorizontal: space.l, paddingBottom: space.l },
});
