/** Plain character-level Levenshtein distance. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;

  let previous = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const current = [i, ...Array<number>(m).fill(0)];
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (previous[j] as number) + 1,
        (current[j - 1] as number) + 1,
        (previous[j - 1] as number) + cost,
      );
    }
    previous = current;
  }
  return previous[m] as number;
}

/**
 * Closeness of two words, 0..1. Stands in for phonetic analysis: once accents
 * are stripped, French ASR confusions are mostly orthographically close
 * ("heros"/"zero", "carante"/"quarante").
 */
export function wordSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - levenshtein(a, b) / max;
}

/**
 * Closeness of two token sequences, 0..1.
 *
 * Token-level Levenshtein alignment where substitution cost is scaled by how
 * close the two words are: swapping "zero" for "heros" costs less than
 * swapping it for "quinze".
 */
export function similarity(heard: string[], expected: string[]): number {
  const n = heard.length;
  const m = expected.length;
  if (n === 0 && m === 0) return 1;
  if (n === 0 || m === 0) return 0;

  let previous = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const current = [i, ...Array<number>(m).fill(0)];
    for (let j = 1; j <= m; j++) {
      const cost = 1 - wordSimilarity(heard[i - 1] as string, expected[j - 1] as string);
      current[j] = Math.min(
        (previous[j] as number) + 1,
        (current[j - 1] as number) + 1,
        (previous[j - 1] as number) + cost,
      );
    }
    previous = current;
  }
  return Math.max(0, 1 - (previous[m] as number) / Math.max(n, m));
}
