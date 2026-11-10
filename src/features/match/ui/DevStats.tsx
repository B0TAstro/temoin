import { StyleSheet, Text, View } from 'react-native';

import type { ClipStats } from '@/features/recording';
import { colors, radius } from '@/shared/ui/theme';

/** Dev builds only. What the phone measures (fps, files, events), for tests on a real court */
export function DevStats({
  fps,
  selectedFps,
  stats,
  sessionId,
  eventCount,
  voiceError,
}: {
  fps: number;
  selectedFps: number | undefined;
  stats: ClipStats;
  sessionId: string;
  eventCount: number;
  voiceError: string | undefined;
}) {
  return (
    <View style={styles.stats}>
      <Text style={styles.text}>
        {fps.toFixed(0)} fps mesurés · {selectedFps ?? '—'} configurés
      </Text>
      <Text style={styles.text}>
        {stats.savedCount + 1} points gardés · {stats.totalMB.toFixed(0)} Mo · {stats.deletedCount}{' '}
        fichiers supprimés · {stats.errorCount} erreurs
      </Text>
      <Text style={styles.text}>
        Session {sessionId} · {eventCount} événements
      </Text>
      {voiceError !== undefined && <Text style={styles.text}>Voix : {voiceError}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { backgroundColor: colors.inkSoft, borderRadius: radius, padding: 12, gap: 4 },
  text: { color: colors.lineDim, fontSize: 13, fontVariant: ['tabular-nums'] },
});
