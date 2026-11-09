import type { SideId } from '@/core/score/types';

import type { MatchEvent, MatchView } from './matchLog';

/** What the players decided, looking at the replay. The app never decides. */
export type ReplayOutcome = { kind: 'point'; winner: SideId } | { kind: 'replayed' };

/**
 * The events that record the players' decision, then send every phone back to the score. A point
 * waiting for the other side is confirmed (for the winner they chose) or rejected; otherwise the
 * last counted point is kept, given to the other side, or removed.
 */
export function outcomeEvents(view: MatchView, outcome: ReplayOutcome): MatchEvent[] {
  const events: MatchEvent[] = [];
  if (view.pending !== undefined) {
    events.push(
      outcome.kind === 'point'
        ? { type: 'point-confirmed', winner: outcome.winner }
        : { type: 'point-rejected' },
    );
  } else if (outcome.kind === 'point') {
    if (view.points.at(-1) !== outcome.winner) {
      events.push({ type: 'point-corrected', winner: outcome.winner });
    }
  } else {
    events.push({ type: 'point-undone' });
  }
  events.push({ type: 'var-closed' });
  return events;
}
