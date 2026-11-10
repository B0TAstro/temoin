import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ReplayOutcome } from './logic/outcome';
import type { SideId } from '@/sports/tennis';
import { colors } from '@/shared/ui/theme';

import { BarButton } from './ReplayButtons';

export type Side = { id: SideId; name: string };

/**
 * The three outcomes, always visible. Choosing one asks the other side to confirm on the same
 * screen: the result only counts once both sides agree.
 */
export function OutcomeBar({
  sides,
  onOutcome,
}: {
  sides: readonly [Side, Side];
  onOutcome: (outcome: ReplayOutcome) => void;
}) {
  const [chosen, setChosen] = useState<ReplayOutcome>();

  if (chosen) {
    const label =
      chosen.kind === 'replayed'
        ? 'Point rejoué'
        : `Point ${sides.find((s) => s.id === chosen.winner)?.name ?? ''}`;
    return (
      <View style={styles.confirm}>
        <Text style={styles.confirmText}>{label} : l’autre camp est d’accord ?</Text>
        <View style={styles.outcomes}>
          <BarButton label="Valider" primary onPress={() => onOutcome(chosen)} />
          <BarButton label="Changer" onPress={() => setChosen(undefined)} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.outcomes}>
      {sides.map((side) => (
        <BarButton
          key={side.id}
          label={`Point ${side.name}`}
          onPress={() => setChosen({ kind: 'point', winner: side.id })}
        />
      ))}
      <BarButton label="Point rejoué" onPress={() => setChosen({ kind: 'replayed' })} />
    </View>
  );
}

const styles = StyleSheet.create({
  outcomes: { gap: 8 },
  confirm: { gap: 12 },
  confirmText: { color: colors.line, fontSize: 20, fontWeight: '700', textAlign: 'center' },
});
