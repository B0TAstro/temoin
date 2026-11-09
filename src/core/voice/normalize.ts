import { BIGRAMS, CANONICAL, STOP_WORDS } from './lexicon';

/** Rejoins words the engine split in two, left to right. */
function joinSplitWords(words: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const pair = BIGRAMS[`${words[i]} ${words[i + 1] ?? ''}`];
    if (pair !== undefined) {
      out.push(pair);
      i++;
    } else {
      out.push(words[i] as string);
    }
  }
  return out;
}

/**
 * Raw text from a speech engine -> canonical tokens.
 *
 * The normaliser does not try to understand: it makes two spellings of the
 * same thing identical. Meaning is settled later, by comparing against the
 * expected phrasings, which go through this very same function.
 */
export function normalize(text: string): string[] {
  const words = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // accents
    .replace(/[^a-z0-9]+/g, ' ') // punctuation, [unk] brackets, hyphens
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  return joinSplitWords(words)
    .map((w) => CANONICAL[w] ?? w)
    .filter((w) => !STOP_WORDS.has(w));
}
