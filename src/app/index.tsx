import { StyleSheet, Text, View } from 'react-native';

export default function Home() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title} accessibilityRole="header">
        Témoin
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '700',
  },
});
