/** Spoken counting words, in normalised form. Games counts, not point values. */
const NUMBERS: Record<string, number> = {
  zero: 0,
  un: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
};

export interface GamesPrefix {
  /** Games spoken first, which by convention are the server's. */
  server: number;
  receiver: number;
  /** What is left to match against the point phrasings. */
  rest: string[];
}

/**
 * Reads a leading games count off a spelled-out score, if there is one.
 *
 * "quatre jeux à deux trente quinze" -> { server: 4, receiver: 2, rest: [trente, quinze] }
 *
 * The games count is CORROBORATION, not a discriminator: every hypothesis
 * shares it, so leaving it in the comparison only dilutes the differences that
 * matter. It is checked separately and stripped before matching.
 */
/** Normalisation splits "dix-sept" in two: a tie-break score, never a games count of 10-7. */
const AFTER_DIX = new Set(['sept', 'huit', 'neuf']);

export function splitGamesPrefix(tokens: string[]): GamesPrefix | null {
  const server = NUMBERS[tokens[0] ?? ''];
  if (server === undefined) return null;
  if (tokens[0] === 'dix' && AFTER_DIX.has(tokens[1] ?? '')) return null;

  let i = 1;
  if (tokens[i] === 'jeu') i++;
  if (tokens[i] === 'a') i++;

  const receiver = NUMBERS[tokens[i] ?? ''];
  if (receiver === undefined) return null;

  const rest = tokens.slice(i + 1);
  // Nothing left means this was never a prefix: "zéro zéro" is the 0-0 point
  // call and "trois deux" is a games call, not the start of a longer score.
  if (rest.length === 0) return null;

  return { server, receiver, rest };
}
