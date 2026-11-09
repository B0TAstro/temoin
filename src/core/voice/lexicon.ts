/* ───────────────────────────────────────────────────────────────────────────
 * The KEYS AND VALUES below are spoken French, not identifiers. They encode
 * what the speech engine actually emits. Translating them breaks recognition.
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Fallback table towards a canonical form.
 *
 * Two sources feed this table and must not be conflated:
 *  - legitimate tennis SYNONYMS ("rien" for "zero", "deuce" for "egalite");
 *  - ASR CONFUSIONS actually observed (see temoin-poc-voice-score/docs/step-0-findings.md).
 *
 * Every error seen in the field is added here, with a regression test in
 * normalize.test.ts. This is the only place encoding what the engine gets wrong.
 */
export const CANONICAL: Record<string, string> = {
  // --- digits to words (Whisper and Vosk alternate without warning) ---
  '0': 'zero',
  '1': 'un',
  '2': 'deux',
  '3': 'trois',
  '4': 'quatre',
  '5': 'cinq',
  '6': 'six',
  '7': 'sept',
  '8': 'huit',
  '9': 'neuf',
  '10': 'dix',
  '11': 'onze',
  '12': 'douze',
  '15': 'quinze',
  '30': 'trente',
  '40': 'quarante',

  // --- tennis synonyms ---
  rien: 'zero',
  deuce: 'egalite',
  partout: 'a',
  tout: 'a',
  serveur: 'service',
  dedans: 'service',
  dans: 'service',
  relanceur: 'dehors',
  recu: 'dehors',
  out: 'dehors',
  jeux: 'jeu',
  game: 'jeu',

  // --- ASR confusions observed (step-0 spike, synthetic voice) ---
  avantages: 'avantage', // "avantages service"
  av: 'avantage',
  je: 'jeu', // "jeu" heard as "je" in free mode
  ans: 'a', // "quinze A" heard as "quinze ans"
};

/** Tokens carrying no discriminating value: dropped before comparison. */
export const STOP_WORDS = new Set([
  'unk', // Vosk's rejection token, often absorbs the initial breath
  'l',
  'le',
  'la',
  'les',
  'd',
  'du',
  'des',
  'et',
  'est',
  'c',
  'ce',
  'on',
  'pour',
]);

/**
 * Words the engine splits in two. Rejoined BEFORE the word-by-word table,
 * otherwise "de" would go to stop words and "hors" would be left orphaned.
 * Key = the two tokens separated by a space.
 */
export const BIGRAMS: Record<string, string> = {
  'avant age': 'avantage',
  'a vantage': 'avantage',
  'de hors': 'dehors',
  'e galite': 'egalite',
  'de dans': 'service',
};
