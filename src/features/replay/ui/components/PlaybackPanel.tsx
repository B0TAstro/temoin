import { type ReactNode, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/shared/ui/theme';

import { ControlButton } from './ControlButton';

export const RATES = [0.25, 0.5, 1] as const;

/**
 * The right panel of the replay: time, the bar with the sound peaks, frame by frame, speed, and the players' decision at the bottom
 */
export function PlaybackPanel({
  timeS,
  totalS,
  rate,
  onRate,
  playing,
  onTogglePlay,
  onStepFrame,
  peaks,
  onJumpToPeak,
  onSeek,
  footer,
}: {
  timeS: number;
  totalS: number;
  rate: number;
  onRate: (rate: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  onStepFrame: (direction: 1 | -1) => void;
  peaks: readonly number[];
  onJumpToPeak: (direction: 1 | -1) => void;
  onSeek: (t: number) => void;
  footer: ReactNode;
}) {
  const [barWidth, setBarWidth] = useState(1);
  const progress = totalS > 0 ? timeS / totalS : 0;

  return (
    <SafeAreaView style={styles.panel} edges={['top', 'bottom', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.time}>
          {(timeS - totalS).toFixed(2)} s · x{rate}
        </Text>
        <Pressable
          style={styles.track}
          onLayout={(e) => setBarWidth(Math.max(1, e.nativeEvent.layout.width))}
          onPress={(e) => onSeek((e.nativeEvent.locationX / barWidth) * totalS)}
        >
          <View style={[styles.trackFill, { width: `${Math.min(100, progress * 100)}%` }]} />
          {peaks.map((t) => (
            <View
              key={t}
              pointerEvents="none"
              style={[styles.peak, { left: `${(t / totalS) * 100}%` }]}
            />
          ))}
        </Pressable>
        {peaks.length > 0 && (
          <View style={styles.row}>
            <ControlButton label="◀ Son" onPress={() => onJumpToPeak(-1)} />
            <ControlButton label="Son ▶" onPress={() => onJumpToPeak(1)} />
          </View>
        )}

        <View style={styles.row}>
          <ControlButton label="◀◀" onPress={() => onStepFrame(-1)} />
          <ControlButton label={playing ? '❚❚' : '▶'} onPress={onTogglePlay} />
          <ControlButton label="▶▶" onPress={() => onStepFrame(1)} />
        </View>
        <View style={styles.row}>
          {RATES.map((r) => (
            <ControlButton
              key={r}
              label={`x${r}`}
              selected={rate === r}
              onPress={() => onRate(r)}
            />
          ))}
        </View>
        {footer}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  panel: { width: 300, backgroundColor: colors.ink },
  content: { padding: 16, gap: 12 },
  time: {
    color: colors.line,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 32,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  trackFill: { height: '100%', backgroundColor: colors.ball },
  /** A sound peak: a mark, not a verdict. */
  peak: { position: 'absolute', top: 6, bottom: 6, width: 2, backgroundColor: colors.line },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
});
