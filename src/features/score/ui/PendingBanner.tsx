import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/shared/ui/Button';
import { colors, radius } from '@/shared/ui/theme';

/** A proposed point, waiting for the other side to confirm it on the same screen */
export function PendingBanner({
  winnerName,
  onConfirm,
  onReject,
}: {
  winnerName: string;
  onConfirm: () => void;
  onReject: () => void;
}) {
  return (
    <View style={styles.banner}>
      <Text style={styles.title}>Point pour {winnerName} ?</Text>
      <Text style={styles.detail}>L’autre camp valide.</Text>
      <View style={styles.row}>
        <Button label="Valider" onPress={onConfirm} style={styles.button} />
        <Button label="Refuser" variant="outline" onPress={onReject} style={styles.button} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.inkSoft, borderRadius: radius, padding: 16, gap: 8 },
  title: { color: colors.line, fontSize: 26, fontWeight: '800' },
  detail: { color: colors.lineDim, fontSize: 18 },
  row: { flexDirection: 'row', gap: 16, marginTop: 4 },
  button: { flex: 1 },
});
