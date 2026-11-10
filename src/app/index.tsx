import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/shared/ui/Button';
import { colors } from '@/shared/ui/theme';

/** Home: two big buttons, nothing else (design.md §5.1). */
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
  actions: { gap: 16, marginBottom: 48 },
});
