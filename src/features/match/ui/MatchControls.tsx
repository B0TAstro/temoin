import { Alert, StyleSheet } from 'react-native';

import { PendingBanner } from '@/features/score';
import type { MatchEvent, MatchView } from '@/features/session';
import { Button } from '@/shared/ui/Button';
import { touch } from '@/shared/ui/theme';
import { type SideId, sideName } from '@/sports/tennis';

export type MatchTab = 'score' | 'training';

/**
 * The match buttons, under the thumb: who won the point (or confirm the proposed one), VAR, and
 * "Annuler le point".
 */
export function MatchControls({
  view,
  tab,
  opening,
  dispatch,
}: {
  view: MatchView;
  tab: MatchTab;
  /** VAR pressed, the clips are still being written. */
  opening: boolean;
  dispatch: (event: MatchEvent) => void;
}) {
  const { state, pending, points } = view;
  const [a, b] = state.config.sides;
  const name = (side: SideId) => sideName(state, side);
  const canPropose = pending === undefined && state.matchWonBy === undefined;

  /** Training shortcut: the point counts at once, both sides agreeing. */
  const award = (winner: SideId) => {
    dispatch({ type: 'point-proposed', winner });
    dispatch({ type: 'point-confirmed' });
  };

  const undo = () =>
    Alert.alert('Annuler le dernier point ?', 'Le score revient au point précédent.', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Annuler le point',
        style: 'destructive',
        onPress: () => dispatch({ type: 'point-undone' }),
      },
    ]);

  return (
    <>
      {pending !== undefined ? (
        <PendingBanner
          winnerName={name(pending)}
          onConfirm={() => dispatch({ type: 'point-confirmed' })}
          onReject={() => dispatch({ type: 'point-rejected' })}
        />
      ) : tab === 'score' ? (
        [a, b].map((side) => (
          <Button
            key={side.id}
            label={`+1 ${name(side.id)}`}
            onPress={() => dispatch({ type: 'point-proposed', winner: side.id })}
            disabled={!canPropose}
            style={styles.action}
          />
        ))
      ) : (
        <>
          <Button
            label="Serveur"
            onPress={() => award(state.server)}
            disabled={!canPropose}
            style={styles.action}
          />
          <Button
            label="Relanceur"
            onPress={() => award(state.server === a.id ? b.id : a.id)}
            disabled={!canPropose}
            style={styles.action}
          />
        </>
      )}
      <Button
        label={opening ? '…' : 'VAR'}
        variant="var"
        onPress={() => dispatch({ type: 'var-opened' })}
        disabled={view.varOpen}
        style={styles.action}
      />
      <Button
        label="Annuler le point"
        variant="outline"
        onPress={undo}
        disabled={pending !== undefined || points.length === 0}
        style={styles.action}
      />
    </>
  );
}

const styles = StyleSheet.create({
  action: { minHeight: touch },
});
