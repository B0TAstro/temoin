import { Link, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/ui/Button';
import { colors } from '@/ui/theme';

/** Home: two big buttons, nothing else (DESIGN §5.1). */
export default function Home() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Témoin
        </Text>
        <Text style={styles.subtitle}>Montrer plutôt que trancher.</Text>
      </View>

      <View style={styles.actions}>
        <Button label="Créer une session" onPress={() => router.push('/create')} />
        <Button
          label="Rejoindre une session"
          variant="outline"
          onPress={() => router.push('/join')}
        />
      </View>

      {/* Spike screen, reachable in release builds too so the PR APK can run it on Android. */}
      <Link href="/dev/recorder" style={styles.devLink}>
        Test enregistreur
      </Link>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  header: { marginTop: 48, gap: 8 },
  title: { color: colors.line, fontSize: 56, fontWeight: '800' },
  subtitle: { color: colors.lineDim, fontSize: 20 },
  actions: { gap: 16 },
  devLink: { color: colors.lineDim, fontSize: 16, textAlign: 'center', padding: 16 },
});
