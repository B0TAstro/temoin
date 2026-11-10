import { StyleSheet, Text, View } from 'react-native';

import { pointText, roleLabel, sideName } from '@/core/score/labels';
import type { MatchState } from '@/core/score/types';
import { colors } from '@/shared/ui/theme';

/** The match screen's score: readable from a distance, nothing else. */
export function ScoreDisplay({ state }: { state: MatchState }) {
  const [a, b] = state.config.sides;

  return (
    <View style={styles.screen}>
      <View style={styles.points}>
        {[a, b].map((side) => (
          <View key={side.id} style={styles.column}>
            <Text style={styles.name} numberOfLines={1}>
              {sideName(state, side.id)}
            </Text>
            <View style={styles.roleRow}>
              {state.server === side.id && <View style={styles.ball} />}
              <Text style={styles.role}>{roleLabel(state, side.id)}</Text>
            </View>
            {/* The landscape column is narrow on small phones: a two-digit score shrinks to fit. */}
            <Text style={styles.point} numberOfLines={1} adjustsFontSizeToFit>
              {pointText(state, side.id)}
            </Text>
          </View>
        ))}
      </View>

      {state.tieBreak !== undefined && (
        <Text style={styles.badge}>{state.tieBreak.isSuper ? 'SUPER TIE-BREAK' : 'TIE-BREAK'}</Text>
      )}

      <View style={styles.counters}>
        <View style={styles.counter}>
          <Text style={styles.counterLabel}>Jeux</Text>
          <Text style={styles.counterValue}>
            {state.games[a.id]} — {state.games[b.id]}
          </Text>
        </View>
        <View style={styles.counter}>
          <Text style={styles.counterLabel}>Sets</Text>
          <Text style={styles.counterValue}>
            {state.sets[a.id]} — {state.sets[b.id]}
          </Text>
        </View>
      </View>

      {state.matchWonBy !== undefined && (
        <Text style={styles.over}>Match terminé · {sideName(state, state.matchWonBy)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 24 },
  points: { flexDirection: 'row' },
  column: { flex: 1, alignItems: 'center', gap: 4 },
  name: { color: colors.line, fontSize: 22, fontWeight: '700' },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ball: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.ball },
  role: { color: colors.lineDim, fontSize: 16 },
  point: {
    color: colors.line,
    fontSize: 112,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  badge: {
    alignSelf: 'center',
    color: colors.ink,
    backgroundColor: colors.ball,
    fontSize: 16,
    fontWeight: '800',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  counters: { flexDirection: 'row', justifyContent: 'center', gap: 48 },
  counter: { alignItems: 'center', gap: 2 },
  counterLabel: { color: colors.lineDim, fontSize: 16 },
  counterValue: {
    color: colors.line,
    fontSize: 40,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  over: { color: colors.ball, fontSize: 20, fontWeight: '700', textAlign: 'center' },
});
