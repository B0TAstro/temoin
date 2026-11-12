/** Width of one loudness value read from a clip (readSoundLevels) */
export const LEVEL_WINDOW_MS = 10;

/** A mark is this many times louder than the clip's background (the median window): +12 dB */
const ABOVE_BACKGROUND = 4;
/** Below this RMS a sound is too faint to mean anything, whatever the background */
const MIN_LEVEL = 0.02;
/** A hit and its bounce are further apart than this: closer peaks are one sound */
const MIN_GAP_S = 0.08;

/**
 * Times (in seconds from the start of the file) of the sharp sounds in a clip: racket hits and bounces, but also a shout or a ball on the fence
 */
export function findSoundPeaks(levels: readonly number[], windowMs = LEVEL_WINDOW_MS): number[] {
  if (levels.length === 0) return [];
  const windowS = windowMs / 1000;
  const sorted = [...levels].sort((a, b) => a - b);
  const background = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const threshold = Math.max(background * ABOVE_BACKGROUND, MIN_LEVEL);

  const peaks: { i: number; level: number }[] = [];
  levels.forEach((level, i) => {
    if (level < threshold) return;
    if (level < (levels[i - 1] ?? 0) || level < (levels[i + 1] ?? 0)) return;
    const last = peaks.at(-1);
    if (last && (i - last.i) * windowS < MIN_GAP_S) {
      if (level > last.level) peaks[peaks.length - 1] = { i, level };
      return;
    }
    peaks.push({ i, level });
  });
  return peaks.map((peak) => peak.i * windowS);
}

/**
 * Where "◀ Son" / "Son ▶" lands from `nowS`: `leadS` before the previous or next peak, to see the ball come in frame by frame
 */
export function stopBeforePeak(
  peaks: readonly number[],
  nowS: number,
  direction: 1 | -1,
  leadS: number,
): number | undefined {
  const targets = peaks.map((t) => Math.max(0, t - leadS));
  return direction === 1
    ? targets.find((t) => t > nowS + 0.01)
    : targets.findLast((t) => t < nowS - 0.01);
}
