import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/shared/ui/theme';

import { ClipPlayer } from './ClipPlayer';
import { NavButton } from './components/NavButton';
import { OutcomeBar, type Side } from './components/OutcomeBar';
import type { ReplayOutcome } from '../logic/outcome';
import type { ReplayClip } from '../logic/toReplayClips';

type Props = {
  clips: readonly ReplayClip[];
  initialIndex: number;
  fps: number;
  sides: readonly [Side, Side];
  onOutcome: (outcome: ReplayOutcome) => void;
  onClose: () => void;
};

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
