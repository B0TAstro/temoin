import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  isScannedCode,
  type ScannedObject,
  type ScannedObjectType,
  useCameraPermission,
  useObjectOutput,
} from 'react-native-vision-camera';

import { parseJoinLink } from '@/features/session/joinLink';
import { Button } from '@/ui/Button';
import { colors, radius } from '@/ui/theme';

const QR_TYPES: ScannedObjectType[] = ['qr'];

function openMatch(sessionId: string) {
  // replace: the scanner unmounts and frees the camera for the match screen.
  router.replace({ pathname: '/match', params: { role: 'guest', s: sessionId } });
}

/** Scans the host's QR code (DESIGN §5.3). Also reached through the temoin://join link. */
export default function JoinScreen() {
  const { s } = useLocalSearchParams<{ s?: string }>();
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const [invalid, setInvalid] = useState(false);
  const done = useRef(false);

  // Opened from the iPhone Camera app: the link already carries the session.
  useEffect(() => {
    if (s && !done.current) {
      done.current = true;
      openMatch(s);
    }
  }, [s]);

  useEffect(() => {
    if (!hasPermission && canRequestPermission) requestPermission();
  }, [hasPermission, canRequestPermission, requestPermission]);

  const objectOutput = useObjectOutput({
    types: QR_TYPES,
    onObjectsScanned: (objects: ScannedObject[]) => {
      if (done.current) return;
      for (const object of objects) {
        const sessionId =
          isScannedCode(object) && object.value ? parseJoinLink(object.value) : null;
        if (sessionId) {
          done.current = true;
          openMatch(sessionId);
          return;
        }
      }
      setInvalid(true);
    },
  });

  return (
    <View style={styles.container}>
      {hasPermission && (
        <Camera
          style={StyleSheet.absoluteFill}
          device="back"
          isActive
          outputs={[objectOutput]}
          resizeMode="cover"
        />
      )}
      <SafeAreaView style={styles.overlay}>
        <Text style={styles.title}>Scannez le QR code du téléphone hôte</Text>
        <Text style={styles.hint}>
          {invalid ? 'Ce n’est pas un code de session Témoin.' : 'Affiché sur l’écran de match.'}
        </Text>
        <View style={styles.frame} />
        <Button label="Annuler" variant="outline" onPress={() => router.back()} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
  },
  title: { color: colors.line, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  hint: { color: colors.line, fontSize: 18, textAlign: 'center' },
  frame: {
    width: 260,
    height: 260,
    borderRadius: radius,
    borderWidth: 4,
    borderColor: colors.ball,
  },
});
