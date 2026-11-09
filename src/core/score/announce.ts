import type { MatchState, Point, SideId } from '@/core/score/types';

/* ───────────────────────────────────────────────────────────────────────────
 * The STRING LITERALS below are spoken French, not identifiers. They are the
 * data we match heard speech against. Translating them breaks recognition.
 * Same rule applies to nlp/lexicon.ts.
 * ──────────────────────────────────────────────────────────────────────── */

const POINT_WORD: Record<string, string> = {
  '0': 'zéro',
  '15': 'quinze',
  '30': 'trente',
  '40': 'quarante',
};

const NUMBER_WORD = [
  'zéro',
  'un',
  'deux',
  'trois',
  'quatre',
  'cinq',
  'six',
  'sept',
  'huit',
  'neuf',
  'dix',
  'onze',
  'douze',
  'treize',
  'quatorze',
  'quinze',
  'seize',
  'dix-sept',
  'dix-huit',
  'dix-neuf',
  'vingt',
];

function otherSide(state: MatchState, side: SideId): SideId {
  const [a, b] = state.config.sides;
  return side === a.id ? b.id : a.id;
}

function playerNames(state: MatchState, side: SideId): string[] {
  return state.config.sides.find((s) => s.id === side)?.players.map((p) => p.name) ?? [];
}

/** Ways of calling a point score, always from the server's point of view. */
function pointPhrasings(serverPoint: Point, receiverPoint: Point): string[] {
  if (serverPoint === 'AD') {
    return ['avantage service', 'avantage serveur', 'avantage dedans', 'a service'];
  }
  if (receiverPoint === 'AD') {
    return ['avantage dehors', 'avantage relanceur', 'avantage reçu', 'a dehors'];
  }
  if (serverPoint === 40 && receiverPoint === 40) {
    // "quarante quarante" and "a quarante" come from real courts, reported
    // after the first on-device session. "égalité" is the formal call; plenty
    // of players never use it.
    return [
      'égalité',
      'quarante a',
      'quarante partout',
      'quarante quarante',
      'a quarante',
      'deuce',
    ];
  }
  if (serverPoint === 0 && receiverPoint === 0) {
    return ['zéro zéro', 'zéro partout', 'rien partout'];
  }

  const s = POINT_WORD[String(serverPoint)] as string;
  const r = POINT_WORD[String(receiverPoint)] as string;

  if (serverPoint === receiverPoint) {
    return [`${s} a`, `${s} partout`, `${s} ${s}`];
  }
  return [`${s} ${r}`, `${s} à ${r}`];
}

/** Plain-number calls, used inside a tie-break. Server's score first. */
function tieBreakPhrasings(serverPoints: number, receiverPoints: number): string[] {
  const s = NUMBER_WORD[serverPoints] ?? String(serverPoints);
  const r = NUMBER_WORD[receiverPoints] ?? String(receiverPoints);

  if (serverPoints === 0 && receiverPoints === 0) {
    return ['zéro zéro', 'zéro partout', 'rien partout'];
  }
  if (serverPoints === receiverPoints) {
    return [`${s} a`, `${s} partout`, `${s} ${s}`];
  }
  return [`${s} ${r}`, `${s} à ${r}`];
}

/** Ways of calling the end of a game. The games count is a second anchor. */
function gamePhrasings(before: MatchState, after: MatchState): string[] {
  const winner = winnerOfGame(before, after);
  const loser = otherSide(before, winner);

  // Read off `before`, not `after`: winning a set resets the games to 0-0, and
  // the call still has to name the score that was just completed.
  const won = (before.games[winner] as number) + 1;
  const lost = before.games[loser] as number;
  const wonWord = NUMBER_WORD[won] ?? String(won);
  const lostWord = NUMBER_WORD[lost] ?? String(lost);
  const plural = won > 1 ? 'jeux' : 'jeu';

  const phrasings = [
    'jeu',
    ...playerNames(after, winner).map((name) => `jeu ${name}`),
    `jeu ${wonWord} ${plural} à ${lostWord}`,
    `jeu ${wonWord} ${lostWord}`,
    `${wonWord} ${plural} à ${lostWord}`,
    `${wonWord} ${lostWord}`,
  ];

  const setTaken = before.sets[winner] !== after.sets[winner];
  if (setTaken) {
    phrasings.push('jeu et set', `jeu et set ${wonWord} ${lostWord}`);
  }
  if (after.matchWonBy !== undefined) {
    phrasings.push('jeu set et match');
  }
  return phrasings;
}

/** Which side closed the game: the one whose games moved, or who took the set. */
function winnerOfGame(before: MatchState, after: MatchState): SideId {
  const [a, b] = before.config.sides;
  if (before.sets[a.id] !== after.sets[a.id]) return a.id;
  if (before.sets[b.id] !== after.sets[b.id]) return b.id;
  return (after.games[a.id] as number) > (before.games[a.id] as number) ? a.id : b.id;
}

/**
 * Every plausible way of calling the move from `before` to `after`.
 * The matcher compares heard speech against these strings.
 */
export function expectedPhrasings(before: MatchState, after: MatchState): string[] {
  const server = before.server;
  const receiver = otherSide(before, server);

  const gameWon =
    after.games[server] !== before.games[server] ||
    after.games[receiver] !== before.games[receiver] ||
    before.sets[server] !== after.sets[server] ||
    before.sets[receiver] !== after.sets[receiver];

  if (gameWon) return gamePhrasings(before, after);

  if (after.tieBreak !== undefined) {
    // Service moves inside a tie-break, so the announcer is the server of the
    // point about to be played, which is the one `after` carries.
    const caller = after.server;
    const other = otherSide(after, caller);
    return tieBreakPhrasings(
      after.tieBreak.points[caller] as number,
      after.tieBreak.points[other] as number,
    );
  }

  return pointPhrasings(after.points[server] as Point, after.points[receiver] as Point);
}

/**
 * The whole score spelled out: games then points, server first.
 *
 * Exists for one reason: a long jump in the score must not be applied on the
 * strength of a two-word call like "trente partout", which noise produces too
 * easily. Four numbers instead of two make the utterance self-corroborating.
 *
 * Returns nothing before the first game is over — "zéro jeu à zéro" is not
 * something anyone says, and with no games played there is no anchor to gain.
 */
export function fullScorePhrasings(before: MatchState, after: MatchState): string[] {
  const server = before.server;
  const receiver = otherSide(before, server);

  const gamesMoved =
    after.games[server] !== before.games[server] ||
    after.games[receiver] !== before.games[receiver];
  if (gamesMoved) return []; // that is a game call, see gamePhrasings

  const won = after.games[server] as number;
  const lost = after.games[receiver] as number;
  if (won === 0 && lost === 0) return [];

  const wonWord = NUMBER_WORD[won] ?? String(won);
  const lostWord = NUMBER_WORD[lost] ?? String(lost);
  const plural = won > 1 ? 'jeux' : 'jeu';

  const points = pointPhrasings(after.points[server] as Point, after.points[receiver] as Point);

  return points.flatMap((point) => [
    `${wonWord} ${plural} à ${lostWord} ${point}`,
    `${wonWord} ${lostWord} ${point}`,
  ]);
}
