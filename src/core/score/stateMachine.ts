import type { MatchConfig, MatchState, Point, SideId, TieBreak } from './types';

const LADDER: Point[] = [0, 15, 30, 40];
const ALL_POINTS: Point[] = [0, 15, 30, 40];

export function createMatch(config: MatchConfig, firstServer: SideId): MatchState {
  return {
    config,
    server: firstServer,
    points: { [config.sides[0].id]: 0, [config.sides[1].id]: 0 },
    games: { [config.sides[0].id]: 0, [config.sides[1].id]: 0 },
    sets: { [config.sides[0].id]: 0, [config.sides[1].id]: 0 },
    endsSwapped: false,
  };
}

function opponent(state: MatchState, side: SideId): SideId {
  const [a, b] = state.config.sides;
  return side === a.id ? b.id : a.id;
}

/**
 * Closes a game: banks it, and cascades into set and match if that is what it
 * turns out to be. Shared by the normal game path and the tie-break.
 */
function afterGame(state: MatchState, winner: SideId): MatchState {
  const loser = opponent(state, winner);
  const games = { ...state.games, [winner]: (state.games[winner] as number) + 1 };
  const { gamesToWinSet, setsToWinMatch, tieBreakAt, tieBreakTarget, superTieBreakTarget } =
    state.config;

  const won = games[winner] as number;
  const lost = games[loser] as number;
  // A tie-break is won 7-6, so one game clear is enough when it decided the set. A match
  // tie-break is the whole deciding set on its own.
  const setWon =
    state.tieBreak?.isSuper === true ||
    (won >= gamesToWinSet && (won - lost >= 2 || state.tieBreak !== undefined));

  // After a tie-break the starter receives first in the next set, which is
  // exactly what normal alternation gives: the tie-break counts as one game.
  const nextServer = opponent(state, state.tieBreak?.starter ?? state.server);
  // The key is dropped, not set to undefined: the tie-break is over.
  const { tieBreak: _over, ...carried } = state;
  // Ends change after every odd game of the set, the tie-break counting as one game (7-6 = 13).
  const endsSwapped = (won + lost) % 2 === 1 ? !state.endsSwapped : state.endsSwapped;
  const base = { ...carried, server: nextServer, endsSwapped };

  if (!setWon) {
    const inTieBreak = games[winner] === tieBreakAt && games[loser] === tieBreakAt;
    return {
      ...base,
      points: { [winner]: 0, [loser]: 0 },
      games,
      ...(inTieBreak
        ? { tieBreak: newTieBreak(winner, loser, nextServer, tieBreakTarget, false) }
        : {}),
    };
  }

  const sets = { ...state.sets, [winner]: (state.sets[winner] as number) + 1 };
  const matchWon = (sets[winner] as number) >= setsToWinMatch;
  // One set all (in best of three): the deciding set is a match tie-break, if the format says so.
  const decidingSet = sets[winner] === setsToWinMatch - 1 && sets[loser] === setsToWinMatch - 1;
  return {
    ...base,
    points: { [winner]: 0, [loser]: 0 },
    games: { [winner]: 0, [loser]: 0 },
    sets,
    ...(matchWon ? { matchWonBy: winner } : {}),
    ...(!matchWon && decidingSet && superTieBreakTarget !== null
      ? { tieBreak: newTieBreak(winner, loser, nextServer, superTieBreakTarget, true) }
      : {}),
  };
}

function newTieBreak(
  a: SideId,
  b: SideId,
  starter: SideId,
  target: number,
  isSuper: boolean,
): TieBreak {
  return { points: { [a]: 0, [b]: 0 }, starter, target, isSuper };
}

/**
 * Who serves point number `played` of a tie-break.
 * The starter serves one point alone, then service changes every two.
 */
function tieBreakServer(state: MatchState, starter: SideId, played: number): SideId {
  return Math.floor((played + 1) / 2) % 2 === 0 ? starter : opponent(state, starter);
}

function applyTieBreakPoint(state: MatchState, winner: SideId): MatchState {
  const tieBreak = state.tieBreak as TieBreak;
  const loser = opponent(state, winner);
  const points = { ...tieBreak.points, [winner]: (tieBreak.points[winner] as number) + 1 };

  const won = points[winner] as number;
  const lost = points[loser] as number;
  if (won >= tieBreak.target && won - lost >= 2) {
    // A tie-break counts as one game: it closes the set at 7-6, or the match tie-break at 1-0.
    return afterGame({ ...state, tieBreak: { ...tieBreak, points } }, winner);
  }

  return {
    ...state,
    server: tieBreakServer(state, tieBreak.starter, won + lost),
    tieBreak: { ...tieBreak, points },
    // Inside a tie-break, ends change every six points.
    endsSwapped: (won + lost) % 6 === 0 ? !state.endsSwapped : state.endsSwapped,
  };
}

export function applyPoint(state: MatchState, winner: SideId): MatchState {
  if (state.matchWonBy !== undefined) return state;

  if (state.tieBreak !== undefined) return applyTieBreakPoint(state, winner);

  const loser = opponent(state, winner);
  const mine = state.points[winner] as Point;
  const theirs = state.points[loser] as Point;

  const winsGame =
    mine === 'AD' ||
    (mine === 40 && theirs !== 40 && theirs !== 'AD') ||
    (mine === 40 && theirs === 40 && state.config.noAd);

  if (winsGame) {
    return afterGame(state, winner);
  }

  // Scoring against the opponent's advantage: back to deuce.
  if (theirs === 'AD') {
    return { ...state, points: { [winner]: 40, [loser]: 40 } };
  }

  // Scoring at deuce: take the advantage.
  if (mine === 40 && theirs === 40) {
    return { ...state, points: { ...state.points, [winner]: 'AD' } };
  }

  const next = LADDER[LADDER.indexOf(mine) + 1] as Point;
  return { ...state, points: { ...state.points, [winner]: next } };
}

export type Role = 'server' | 'receiver';

export interface Candidate {
  role: Role;
  winner: SideId;
  state: MatchState;
}

/**
 * The hinge of this POC: at any point there are only two possible next scores.
 * We never parse French freely, we choose between these two.
 */
export function nextCandidates(state: MatchState): [Candidate, Candidate] {
  const receiver = opponent(state, state.server);
  return [
    { role: 'server', winner: state.server, state: applyPoint(state, state.server) },
    { role: 'receiver', winner: receiver, state: applyPoint(state, receiver) },
  ];
}

/** Signature of a score, to compare two states. */
export function stateKey(state: MatchState): string {
  const [a, b] = state.config.sides;
  const points =
    state.tieBreak !== undefined
      ? `tb${state.tieBreak.points[a.id]}-${state.tieBreak.points[b.id]}`
      : `${String(state.points[a.id])}-${String(state.points[b.id])}`;
  return `${points}|${state.games[a.id]}-${state.games[b.id]}|${state.sets[a.id]}-${state.sets[b.id]}`;
}

/** Tie-break scores within reach of the current one, excluding finished ones. */
function plausibleTieBreakStates(state: MatchState): MatchState[] {
  const tieBreak = state.tieBreak as TieBreak;
  const [a, b] = state.config.sides;
  const target = tieBreak.target;

  const around = (current: number) => {
    const low = Math.max(0, current - 2);
    return Array.from({ length: current + 2 - low + 1 }, (_, i) => low + i);
  };

  const states: MatchState[] = [];
  for (const pa of around(tieBreak.points[a.id] as number)) {
    for (const pb of around(tieBreak.points[b.id] as number)) {
      // A score the tie-break could not still be sitting on.
      if (Math.max(pa, pb) >= target && Math.abs(pa - pb) >= 2) continue;
      states.push({
        ...state,
        // Service moves inside a tie-break, so each score has its own server.
        server: tieBreakServer(state, tieBreak.starter, pa + pb),
        tieBreak: { ...tieBreak, points: { [a.id]: pa, [b.id]: pb } },
      });
    }
  }
  return states;
}

/**
 * Every score reachable within the current game, plus the two ways it can end.
 *
 * Used for resynchronisation: a tennis call is ABSOLUTE ("trente quinze" means
 * the score IS 30-15), so the two candidates are a prior, not a hard constraint.
 * Without this escape hatch a single error freezes the score for the whole game.
 */
export function plausibleStates(state: MatchState): MatchState[] {
  if (state.tieBreak !== undefined) return plausibleTieBreakStates(state);

  const [a, b] = state.config.sides;
  const states: MatchState[] = [];

  for (const pa of ALL_POINTS) {
    for (const pb of ALL_POINTS) {
      states.push({ ...state, points: { [a.id]: pa, [b.id]: pb } });
    }
  }
  if (!state.config.noAd) {
    states.push({ ...state, points: { [a.id]: 'AD', [b.id]: 40 } });
    states.push({ ...state, points: { [a.id]: 40, [b.id]: 'AD' } });
  }
  // The current game has just been won, by one side or the other.
  states.push(applyPoint({ ...state, points: { [a.id]: 40, [b.id]: 0 } }, a.id));
  states.push(applyPoint({ ...state, points: { [a.id]: 0, [b.id]: 40 } }, b.id));

  return states;
}

const LADDER_INDEX: Record<string, number> = { '0': 0, '15': 1, '30': 2, '40': 3, AD: 4 };

/** How many point-steps apart two scores are, summed over both sides. */
export function pointDistance(from: MatchState, to: MatchState): number {
  if (from.tieBreak !== undefined && to.tieBreak !== undefined) {
    const x = from.tieBreak;
    const y = to.tieBreak;
    return from.config.sides.reduce(
      (total, side) =>
        total + Math.abs((x.points[side.id] as number) - (y.points[side.id] as number)),
      0,
    );
  }
  return from.config.sides.reduce((total, side) => {
    const a = LADDER_INDEX[String(from.points[side.id])] ?? 0;
    const b = LADDER_INDEX[String(to.points[side.id])] ?? 0;
    return total + Math.abs(a - b);
  }, 0);
}

/** Longest jump we are willing to apply without the score being spelled out. */
export const NEAR_JUMP_LIMIT = 2;

/**
 * A short jump is the "I missed a call" case, and applying it silently is what
 * stops one error freezing the score for the rest of the game. A long jump is
 * startling and must be spelled out in full — see fullScorePhrasings.
 */
export function isNearJump(from: MatchState, to: MatchState): boolean {
  const gamesMoved = from.config.sides.some((s) => from.games[s.id] !== to.games[s.id]);
  if (gamesMoved) return false;
  // Entering or leaving a tie-break is never a short step.
  if ((from.tieBreak === undefined) !== (to.tieBreak === undefined)) return false;
  return pointDistance(from, to) <= NEAR_JUMP_LIMIT;
}

/** Whether the players change ends between these two states (to tell them on screen). */
export function isChangeOfEnds(before: MatchState, after: MatchState): boolean {
  return before.endsSwapped !== after.endsSwapped;
}
