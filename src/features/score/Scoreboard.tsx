import { StyleSheet, Text, View } from 'react-native';

import { pointText, roleLabel, sideName } from '@/core/score/labels';
import type { MatchState, Side } from '@/core/score/types';
import { colors, radius } from '@/ui/theme';

function Row({ side, state }: { side: Side; state: MatchState }) {
  const serving = state.server === side.id;
  return (
    <View style={styles.row}>
      <View style={styles.identity}>
        <View style={[styles.ball, serving && styles.ballActive]} />
        <View>
          <Text style={styles.name} numberOfLines={1}>
            {sideName(state, side.id)}
          </Text>
          <Text style={styles.role}>{roleLabel(state, side.id)}</Text>
        </View>
      </View>
      <Text style={styles.games}>{state.sets[side.id]}</Text>
      <Text style={styles.games}>{state.games[side.id]}</Text>
      <Text style={styles.points}>{pointText(state, side.id)}</Text>
    </View>
  );
}

/** Compact scoreboard for the training tab: sets, games and points side by side. */
export function Scoreboard({ state }: { state: MatchState }) {
  const [a, b] = state.config.sides;
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Camp</Text>
        <Text style={styles.headerColumn}>Sets</Text>
        <Text style={styles.headerColumn}>Jeux</Text>
        <Text style={styles.headerColumn}>{state.tieBreak !== undefined ? 'TB' : 'Points'}</Text>
      </View>
      <Row side={a} state={state} />
      <View style={styles.separator} />
      <Row side={b} state={state} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.inkSoft, borderRadius: radius, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  headerLabel: { flex: 1, color: colors.lineDim, fontSize: 16 },
  headerColumn: { width: 56, textAlign: 'center', color: colors.lineDim, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  ball: { width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.2)' },
  ballActive: { backgroundColor: colors.ball },
  name: { color: colors.line, fontSize: 20, fontWeight: '600' },
  role: { color: colors.lineDim, fontSize: 16 },
  games: {
    width: 56,
    textAlign: 'center',
    color: colors.lineDim,
    fontSize: 28,
    fontVariant: ['tabular-nums'],
  },
  points: {
    width: 56,
    textAlign: 'center',
    color: colors.line,
    fontSize: 36,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  separator: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
});
