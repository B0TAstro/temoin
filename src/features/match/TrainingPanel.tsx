import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { MatchState } from '@/core/score/types';
import type { ClipStats } from '@/features/recording/ClipRecorder';
import { Scoreboard } from '@/features/score/Scoreboard';
import { colors, radius } from '@/shared/ui/theme';

/** The training tab: the full scoreboard and what the phone measures (fps, files, events). */
export function TrainingPanel({
  state,
  fps,
  selectedFps,
  stats,
  sessionId,
  eventCount,
  voiceError,
}: {
  state: MatchState;
  fps: number;
  selectedFps: number | undefined;
  stats: ClipStats;
  sessionId: string;
  eventCount: number;
  voiceError: string | undefined;
}) {
  return (
    <ScrollView contentContainerStyle={styles.training}>
      <Scoreboard state={state} />
      <View style={styles.stats}>
        <Text style={styles.statsText}>
          {fps.toFixed(0)} fps mesurés · {selectedFps ?? '—'} configurés
        </Text>
        <Text style={styles.statsText}>
          {stats.savedCount + 1} points gardés · {stats.totalMB.toFixed(0)} Mo ·{' '}
          {stats.deletedCount} fichiers supprimés · {stats.errorCount} erreurs
        </Text>
        <Text style={styles.statsText}>
          Session {sessionId} · {eventCount} événements
        </Text>
        {voiceError !== undefined && <Text style={styles.statsText}>Voix : {voiceError}</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  training: { gap: 16, paddingVertical: 8 },
  stats: { backgroundColor: colors.inkSoft, borderRadius: radius, padding: 16, gap: 6 },
  statsText: { color: colors.line, fontSize: 15, fontVariant: ['tabular-nums'] },
});
