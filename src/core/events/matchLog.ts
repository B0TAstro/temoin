import { applyPoint, createMatch } from '@/core/score/stateMachine';
import type { MatchConfig, MatchState, SideId } from '@/core/score/types';

/**
 * Everything that changes the match, in order. The score is never stored: it is replayed from
 * this log. With one phone the log lives on it; from v0.2 the host numbers the events and sends
 * them to every phone.
 */
export type MatchEvent =
  /** A player says who won the point. The clip is cut here, as close as possible to the rally. */
  | { type: 'point-proposed'; winner: SideId }
  /** The other side agrees: the point counts, for `winner` if the replay changed their minds. */
  | { type: 'point-confirmed'; winner?: SideId }
  /** The other side disagrees, or the players chose "point rejoué" in the replay. */
  | { type: 'point-rejected' }
  /** The last counted point is removed (a replayed point, after a look at the replay). */
  | { type: 'point-undone' }
  /** The last counted point goes to the other side, after a look at the replay. */
  | { type: 'point-corrected'; winner: SideId };

export type LoggedEvent = MatchEvent & { seq: number };

export type MatchSetup = {
  config: MatchConfig;
  firstServer: SideId;
};

export type MatchView = {
  state: MatchState;
  /** Winners of the counted points, in order. */
  points: SideId[];
  /** A point waiting for the other side to confirm it. */
  pending?: SideId;
};

/** Replays the log into the score. Pure: the same log always gives the same score. */
export function replay(setup: MatchSetup, log: readonly LoggedEvent[]): MatchView {
  const points: SideId[] = [];
  let pending: SideId | undefined;

  for (const event of log) {
    switch (event.type) {
      case 'point-proposed':
        pending ??= event.winner;
        break;
      case 'point-confirmed':
        if (pending !== undefined) points.push(event.winner ?? pending);
        pending = undefined;
        break;
      case 'point-rejected':
        pending = undefined;
        break;
      case 'point-undone':
        points.pop();
        break;
      case 'point-corrected':
        if (points.length > 0) points[points.length - 1] = event.winner;
        break;
    }
  }

  const state = points.reduce(applyPoint, createMatch(setup.config, setup.firstServer));
  return { state, points, ...(pending !== undefined && { pending }) };
}

/** Whether `event` changes anything, given the current view. Invalid intents are ignored. */
export function isValid(view: MatchView, event: MatchEvent): boolean {
  switch (event.type) {
    case 'point-proposed':
      return view.pending === undefined && view.state.matchWonBy === undefined;
    case 'point-confirmed':
    case 'point-rejected':
      return view.pending !== undefined;
    case 'point-undone':
    case 'point-corrected':
      return view.pending === undefined && view.points.length > 0;
  }
}
