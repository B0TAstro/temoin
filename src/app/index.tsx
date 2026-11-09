import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function Home() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title} accessibilityRole="header">
        Témoin
      </Text>
      {/* Spike screens stay reachable in release builds too, so the PR APK can run them on Android.
          Removed once the match screens land. */}
      <Link href="/dev/recorder" style={styles.devLink}>
        Test enregistreur
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    backgroundColor: '#111111',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '700',
  },
  devLink: {
    color: '#E9B44C',
    fontSize: 18,
    padding: 16,
  },
});
