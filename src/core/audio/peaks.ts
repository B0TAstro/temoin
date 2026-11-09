/** Width of one loudness value in the envelope read from a clip. */
export const ENVELOPE_WINDOW_MS = 10;

/**
 * A mark is this many times louder than the clip's background (the median window): +12 dB. The
 * starting point for the values below, to be tuned on a real court.
 */
const ABOVE_BACKGROUND = 4;
/** Below this RMS a sound is too faint to mean anything, whatever the background. */
const MIN_LEVEL = 0.02;
/** A hit and its bounce are further apart than this: closer peaks are one sound. */
const MIN_GAP_S = 0.08;

/**
 * Times (in seconds from the start of the file) of the sharp sounds in a clip: racket hits and
 * bounces, but also a shout or a ball on the fence. A mark says "something loud here", never what
 * it was.
 */
export function findPeaks(envelope: readonly number[], windowMs = ENVELOPE_WINDOW_MS): number[] {
  if (envelope.length === 0) return [];
  const windowS = windowMs / 1000;
  const sorted = [...envelope].sort((a, b) => a - b);
  const background = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const threshold = Math.max(background * ABOVE_BACKGROUND, MIN_LEVEL);

  const peaks: { i: number; level: number }[] = [];
  envelope.forEach((level, i) => {
    if (level < threshold) return;
    // The top of the sound only, not every loud window around it.
    if (level < (envelope[i - 1] ?? 0) || level < (envelope[i + 1] ?? 0)) return;
    const last = peaks.at(-1);
    if (last && (i - last.i) * windowS < MIN_GAP_S) {
      if (level > last.level) peaks[peaks.length - 1] = { i, level };
      return;
    }
    peaks.push({ i, level });
  });
  return peaks.map((peak) => peak.i * windowS);
}
