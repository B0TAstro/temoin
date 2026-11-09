import { expectedPhrasings } from '@/core/score/announce';
import {
  applyPoint,
  isNearJump,
  nextCandidates,
  plausibleStates,
  stateKey,
} from '@/core/score/stateMachine';
import type { Candidate } from '@/core/score/stateMachine';
import type { MatchState, SideId } from '@/core/score/types';
import { splitCommand } from './command';
import { splitGamesPrefix } from './gamesPrefix';
import { normalize } from './normalize';
import { similarity } from './similarity';

/**
 * Thresholds are deliberately asymmetric: missing a call repairs itself (the
 * next one re-anchors the score), getting it wrong silently corrupts the rest
 * of the game. Provisional values, to be tuned on the field corpus.
 */
export interface Thresholds {
  /** Minimum score for a call to be taken seriously. */
  accept: number;
  /** Minimum gap with the runner-up hypothesis. */
  margin: number;
  /** Near-exact match required to jump outside the two candidates. */
  resync: number;
  /** How far a resync must beat the best in-prior hypothesis. */
  resyncMargin: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  accept: 0.62,
  margin: 0.15,
  resync: 0.9,
  resyncMargin: 0.2,
};

export type Decision =
  | {
      type: 'accepted';
      candidate: Candidate;
      score: number;
      margin: number;
      fragile: boolean;
      phrasing: string;
    }
  | {
      type: 'resync';
      state: MatchState;
      from: MatchState;
      score: number;
      fragile: boolean;
      phrasing: string;
    }
  | { type: 'unchanged'; score: number }
  | {
      type: 'rejected';
      reason: 'empty' | 'low-score' | 'low-margin' | 'wrong-games' | 'jump-needs-full-score';
      bestScore: number;
    };

interface Hypothesis {
  candidate: Candidate | null; // null = the state does not move
  score: number;
  phrasing: string;
}

function bestPhrasing(tokens: string[], phrasings: string[]): { score: number; phrasing: string } {
  let best = { score: 0, phrasing: '' };
  for (const p of phrasings) {
    const score = similarity(tokens, normalize(p));
    if (score > best.score) best = { score, phrasing: p };
  }
  return best;
}

/**
 * Chooses between the two possible next scores, or declines to choose.
 *
 * THREE hypotheses are weighed, not two: the server wins, the receiver wins,
 * or the server is simply repeating the current score. Without the third, a
 * repeat would be forced into one of the two candidates.
 */
export function decide(
  state: MatchState,
  text: string,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): Decision {
  const tokens = normalize(text);
  if (tokens.length === 0) return { type: 'rejected', reason: 'empty', bestScore: 0 };

  const [server, receiver] = nextCandidates(state);

  // Two ways to show a long jump is deliberate: say the games count, or say
  // a command word. See temoin-poc-voice-score/docs/step-5-jump-rules.md.
  const command = splitCommand(tokens);
  const afterCommand = command?.rest ?? tokens;

  // A spelled-out score carries the games count. Every hypothesis shares it,
  // so it discriminates nothing and only dilutes the comparison — it is a
  // gate, checked once and stripped.
  const prefix = splitGamesPrefix(afterCommand);
  const games = [state.games[server.winner], state.games[receiver.winner]];
  // Either order is accepted. Service alternates every game, so the
  // server-first convention flips mid-match, and nobody is going to flip it
  // in their head on court. The games count is only a gate; the points carry
  // the convention. Reported after the first on-device session.
  const gamesMatch =
    prefix !== null &&
    ((prefix.server === games[0] && prefix.receiver === games[1]) ||
      (prefix.server === games[1] && prefix.receiver === games[0]));

  if (prefix !== null && !gamesMatch) {
    // The speaker is describing a different game from the one we are tracking.
    return { type: 'rejected', reason: 'wrong-games', bestScore: 0 };
  }

  const spelledOut = gamesMatch || command !== null;
  const heard = prefix?.rest ?? afterCommand;

  const hypotheses: Hypothesis[] = [
    { candidate: server, ...bestPhrasing(heard, expectedPhrasings(state, server.state)) },
    { candidate: receiver, ...bestPhrasing(heard, expectedPhrasings(state, receiver.state)) },
    { candidate: null, ...bestPhrasing(heard, expectedPhrasings(state, state)) },
  ].sort((x, y) => y.score - x.score);

  // Escape hatch: the call may describe a score neither candidate covers,
  // because a point was missed or an error was accepted. Only taken on a
  // near-exact and clearly better match, so the noise tolerance that the
  // two-candidate prior buys us is not thrown away.
  const inPrior = hypotheses[0] as Hypothesis;
  const alreadySeen = new Set([stateKey(server.state), stateKey(receiver.state), stateKey(state)]);
  let outside = { score: 0, phrasing: '', state };

  for (const plausible of plausibleStates(state)) {
    if (alreadySeen.has(stateKey(plausible))) continue;

    // Evidence scales with the size of the jump. A short jump is the "I missed
    // one call" case and applies on an ordinary two-word call — that is what
    // stops a single error freezing the score. A long jump is startling, so
    // the score has to be spelled out, games included.
    if (!isNearJump(state, plausible) && !spelledOut) continue;

    const m = bestPhrasing(heard, expectedPhrasings(state, plausible));
    // A single-token call ("jeu", "a", "dehors") pops out of noise far too
    // easily to move the score at all. See temoin-poc-voice-score/docs/step-0-findings.md Q3.
    if (normalize(m.phrasing).length < 2) continue;

    if (m.score > outside.score) outside = { ...m, state: plausible };
  }

  if (
    outside.score >= thresholds.resync &&
    outside.score - inPrior.score >= thresholds.resyncMargin
  ) {
    return {
      type: 'resync',
      state: outside.state,
      from: state,
      score: outside.score,
      fragile: false, // guaranteed by the filter above
      phrasing: outside.phrasing,
    };
  }

  const best = hypotheses[0] as Hypothesis;
  const runnerUp = hypotheses[1] as Hypothesis;
  const margin = best.score - runnerUp.score;

  if (best.score < thresholds.accept) {
    return { type: 'rejected', reason: 'low-score', bestScore: best.score };
  }
  if (margin < thresholds.margin) {
    return { type: 'rejected', reason: 'low-margin', bestScore: best.score };
  }
  if (best.candidate === null) {
    return { type: 'unchanged', score: best.score };
  }

  return {
    type: 'accepted',
    candidate: best.candidate,
    score: best.score,
    margin,
    // A single-token call sits too close to noise: accept, but flag it.
    // See temoin-poc-voice-score/docs/step-0-findings.md Q3.
    fragile: normalize(best.phrasing).length < 2 && !spelledOut,
    phrasing: best.phrasing,
  };
}

/**
 * The points that lead from `from` to `to`, if at most `limit` points apart: a resync forward is
 * the "a call was missed" case, and the log only knows points. A jump backwards, or one that two
 * orders of points reach, returns null.
 */
export function pointsBetween(from: MatchState, to: MatchState, limit = 2): SideId[] | null {
  const target = stateKey(to);
  let paths: { state: MatchState; winners: SideId[] }[] = [{ state: from, winners: [] }];
  for (let step = 0; step < limit; step++) {
    paths = paths.flatMap(({ state, winners }) =>
      state.config.sides.map((side) => ({
        state: applyPoint(state, side.id),
        winners: [...winners, side.id],
      })),
    );
    const found = paths.filter((path) => stateKey(path.state) === target);
    // 0-0 to 15-15 is A then B, or B then A. The score would be right either way, but undoing or
    // correcting "the last point" would not: better not to apply it than to guess the order.
    if (found.length > 1) return null;
    if (found[0]) return found[0].winners;
  }
  return null;
}
