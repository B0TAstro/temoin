import { COMMAND_SPOKEN } from './command';
import {
  expectedPhrasings,
  fullScorePhrasings,
  type MatchState,
  nextCandidates,
  plausibleStates,
} from '@/sports/tennis';

/** Vosk's rejection token. Without it, the decoder forces noise into the vocabulary. */
export const UNKNOWN = '[unk]';

/**
 * Player names are absent from the model lexicon, and Vosk drops them with a
 * warning (observed in the step-0 spike). They stay in the matcher's expected
 * phrasings — harmless there — but have no business in the grammar.
 * Generated phrasings are all lowercase, so a capital means a name.
 */
const containsPlayerName = (phrasing: string) => /[A-ZÀ-Þ]/.test(phrasing);

/**
 * Words absent from vosk-model-small-fr-0.22, checked against the model rather
 * than guessed. Vosk warns and drops them, so offering them is pure noise.
 */
const MISSING_FROM_MODEL = new Set(['deuce', 'relanceur']);

const usesUnknownWord = (phrasing: string) =>
  phrasing
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .some((word) => MISSING_FROM_MODEL.has(word));

function toGrammar(phrasings: Iterable<string>): string[] {
  const unique = new Set<string>();
  for (const phrasing of phrasings) {
    if (!containsPlayerName(phrasing) && !usesUnknownWord(phrasing)) unique.add(phrasing);
  }
  return [...unique, UNKNOWN];
}

/**
 * Everything callable at any point of the CURRENT game.
 *
 * Deliberately stable within a game: changing the grammar means restarting the
 * recogniser, so we pay that cost once per game rather than once per point.
 * It changes at a game boundary because the games count gets spoken.
 */
export function staticGrammar(state: MatchState): string[] {
  const calls: string[] = [];
  const spelledOut: string[] = [];

  // The two candidates on top: in a tie-break, plausibleStates leaves out the scores that end it,
  // and decide() still expects the "jeu et set" calls.
  const candidates = nextCandidates(state).map((candidate) => candidate.state);
  for (const reachable of [...plausibleStates(state), ...candidates, state]) {
    calls.push(...expectedPhrasings(state, reachable));
    // Without these the decoder cannot produce a spelled-out score at all,
    // and a long jump would be unreachable by voice. Only the canonical point
    // wording is offered: the variants normalise to the same tokens anyway,
    // and every extra entry is one more thing noise can land on.
    spelledOut.push(...fullScorePhrasings(state, reachable).slice(0, 2));
  }

  const base = toGrammar(calls);
  // The spoken command is the other way to authorise a long jump, and the only
  // one available during the first game, where there is no games count yet.
  // Not combined with the spelled-out forms: saying the games already proves
  // intent, so the pair would be redundant grammar bloat.
  const commanded = base.filter((p) => p !== UNKNOWN).map((p) => `${COMMAND_SPOKEN} ${p}`);

  return [...new Set([...base, ...spelledOut, ...commanded])];
}
