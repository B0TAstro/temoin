import { applyPoint, createMatch } from '@/core/score/stateMachine';
import type { MatchConfig, MatchState, SideId } from '@/core/score/types';

/**
 * Everything that changes the match, in order. The score is never stored: it is replayed from
 * this log. The host keeps the log, numbers the events and sends them to every phone.
 */
export type MatchEvent =
  /** A player says who won the point. The clip is cut here, as close as possible to the rally. */
  | { type: 'point-proposed'; winner: SideId }
  /**
   * The server called the new score out loud and the voice recognition understood it. The points
   * count at once, the receiver's silence being their agreement. Usually one winner, two when the
   * call shows a call was missed. `afterSeq` is the last event the phone had when it heard the
   * call: every phone listens, and a call only counts on the log it was heard against. The first
   * call moves the log on, so a second phone's copy, or a late copy after "Annuler le point", is
   * dropped.
   */
  | { type: 'point-called'; winners: SideId[]; afterSeq: number }
  /** The other side agrees: the point counts, for `winner` if the replay changed their minds. */
  | { type: 'point-confirmed'; winner?: SideId }
  /** The other side disagrees, or the players chose "point rejoué" in the replay. */
  | { type: 'point-rejected' }
  /** The last counted point is removed (a replayed point, after a look at the replay). */
  | { type: 'point-undone' }
  /** The last counted point goes to the other side, after a look at the replay. */
  | { type: 'point-corrected'; winner: SideId }
  /** Someone pressed VAR: every phone opens the replay of the same point, each from its angle. */
  | { type: 'var-opened' }
  /** Back to the score on every phone. */
  | { type: 'var-closed' };

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
  /** The replay is open on every phone. */
  varOpen: boolean;
  /** Number of the last event replayed, 0 for an empty log. */
  seq: number;
};

/** Replays the log into the score. Pure: the same log always gives the same score. */
export function replay(setup: MatchSetup, log: readonly LoggedEvent[]): MatchView {
  const points: SideId[] = [];
  let pending: SideId | undefined;
  let varOpen = false;

  for (const event of log) {
    switch (event.type) {
      case 'point-proposed':
        pending ??= event.winner;
        break;
      case 'point-called':
        points.push(...event.winners);
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
      case 'var-opened':
        varOpen = true;
        break;
      case 'var-closed':
        varOpen = false;
        break;
    }
  }

  const state = points.reduce(applyPoint, createMatch(setup.config, setup.firstServer));
  const seq = log.at(-1)?.seq ?? 0;
  return { state, points, varOpen, seq, ...(pending !== undefined && { pending }) };
}

/** Whether `event` changes anything, given the current view. Invalid intents are ignored. */
export function isValid(view: MatchView, event: MatchEvent): boolean {
  switch (event.type) {
    case 'point-proposed':
      return view.pending === undefined && view.state.matchWonBy === undefined;
    case 'point-called':
      // Something happened since the call was heard (another phone's copy of it, an undo): stale.
      // Never during the replay: a call sent just before VAR must not move the frozen score.
      return (
        !view.varOpen &&
        view.pending === undefined &&
        view.state.matchWonBy === undefined &&
        event.afterSeq === view.seq
      );
    case 'point-confirmed':
    case 'point-rejected':
      return view.pending !== undefined;
    case 'point-undone':
    case 'point-corrected':
      return view.pending === undefined && view.points.length > 0;
    case 'var-opened':
      return !view.varOpen;
    case 'var-closed':
      return view.varOpen;
  }
}
