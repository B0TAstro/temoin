import { useEffect, useState } from 'react';

import type { Timeline } from '@/features/recording';

import { findSoundPeaks, LEVEL_WINDOW_MS } from './logic/soundPeaks';
import { readSoundLevels } from './native/readSoundLevels';

/**
 * The sound peaks of the point on screen, on its replay timeline. Read when the replay opens, for
 * this point only: nothing runs while the match is being filmed. Empty until read, and for a silent clip
 */
export function useSoundPeaks(timeline: Timeline): number[] {
  const [peaks, setPeaks] = useState<{ for: Timeline; times: number[] }>();

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      timeline.segments.map(async (segment) => {
        const levels = await readSoundLevels(segment.path, LEVEL_WINDOW_MS).catch(() => []);
        return findSoundPeaks(levels)
          .filter((t) => t <= segment.durationS)
          .map((t) => segment.offsetS + t);
      }),
    ).then((perSegment) => {
      if (!cancelled) setPeaks({ for: timeline, times: perSegment.flat().sort((a, b) => a - b) });
    });
    return () => {
      cancelled = true;
    };
  }, [timeline]);

  return peaks?.for === timeline ? peaks.times : [];
}
