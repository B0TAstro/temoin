import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Segment } from '@/core/clips/Segment';
import type { ReplayOutcome } from '@/core/events/outcome';
import { colors } from '@/ui/theme';

import { ClipPlayer } from './ClipPlayer';
import { OutcomeBar, type Side } from './OutcomeBar';
import { NavButton } from './ReplayButtons';

export type ReplayClip = {
  key: string;
  /** E.g. "Set 1 · Jeu 4 · 30-15". */
  title: string;
  /** E.g. "Dernier point", "Point en cours". */
  subtitle: string;
  segments: readonly Segment[];
};

type Props = {
  /** Oldest first: "◀" goes back in time. */
  clips: readonly ReplayClip[];
  initialIndex: number;
  /** Camera frame rate, used to step exactly one frame. */
  fps: number;
  sides: readonly [Side, Side];
  onOutcome: (outcome: ReplayOutcome) => void;
  /** Back to the score without changing anything. */
  onClose: () => void;
};

/** VAR: one point at a time, with "◀ / ▶" to move between the 3 points kept on the phone. */
export function ReplayScreen({ clips, initialIndex, fps, sides, onOutcome, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const clip = clips[index];
  if (!clip) return null;

  const header = (
    <View style={styles.nav}>
      <NavButton label="◀" disabled={index === 0} onPress={() => setIndex(index - 1)} />
      <View style={styles.navText}>
        <Text style={styles.navSubtitle}>
          {clip.subtitle} · {index + 1}/{clips.length}
        </Text>
        <Text style={styles.navTitle} numberOfLines={2}>
          {clip.title}
        </Text>
      </View>
      <NavButton
        label="▶"
        disabled={index === clips.length - 1}
        onPress={() => setIndex(index + 1)}
      />
    </View>
  );

  return (
    <ClipPlayer
      key={clip.key}
      segments={clip.segments}
      fps={fps}
      header={header}
      footer={<OutcomeBar sides={sides} onOutcome={onOutcome} />}
      onClose={onClose}
    />
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navText: { flexShrink: 1, flexGrow: 1 },
  navSubtitle: { color: colors.ball, fontSize: 16, fontWeight: '800' },
  navTitle: { color: colors.line, fontSize: 18, fontWeight: '800' },
});
