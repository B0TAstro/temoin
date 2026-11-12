import type { Segment } from './Segment';

/** Files shorter than this are skipped */
const MIN_SEGMENT_SECONDS = 0.1;
/** A longer hole between two files is removed */
const MAX_GAP_SECONDS = 1;

export type TimelineSegment = {
  path: string;
  /** Position of the file's first frame on the replay timeline (seconds) */
  offsetS: number;
  durationS: number;
};

export type Timeline = {
  segments: TimelineSegment[];
  totalS: number;
};

/**
 * Lays the files of one point end to end, so the players see a single video with a single scrub bar.
 *
 * Several files after a pause (VAR, background), a refused proposal or the 5 min limit.
 * Offsets come from the JS start times, accurate to a few tens of ms: enough to switch files
 */
export function buildTimeline(all: readonly Segment[]): Timeline {
  const kept = all
    .filter((s) => s.durationS >= MIN_SEGMENT_SECONDS)
    .sort((a, b) => a.startedAt - b.startedAt);
  if (kept.length === 0) return { segments: [], totalS: 0 };

  const segments: TimelineSegment[] = [];
  kept.forEach((s, i) => {
    const previous = segments[i - 1];
    const previousFile = kept[i - 1];
    let offsetS = 0;
    if (previous && previousFile) {
      const sinceStartS = (s.startedAt - previousFile.startedAt) / 1000;
      const gapS = sinceStartS - previous.durationS;
      offsetS = previous.offsetS + (gapS > MAX_GAP_SECONDS ? previous.durationS : sinceStartS);
    }
    segments.push({ path: s.path, offsetS, durationS: s.durationS });
  });
  const totalS = Math.max(...segments.map((s) => s.offsetS + s.durationS));
  return { segments, totalS };
}

const contains = (s: TimelineSegment, t: number) => t >= s.offsetS && t <= s.offsetS + s.durationS;

/**
 * Finds which file plays time `t` and where inside it, for the scrub bar and frame stepping.
 * Keeps `preferIndex` when it covers `t` (switching files flickers), else the newest one covering it
 */
export function locate(
  timeline: Timeline,
  t: number,
  preferIndex?: number,
): { index: number; localS: number } {
  const { segments } = timeline;
  const clamped = Math.min(Math.max(t, 0), timeline.totalS);
  const preferred = preferIndex != null ? segments[preferIndex] : undefined;
  let index = -1;
  if (preferIndex != null && preferred && contains(preferred, clamped)) {
    index = preferIndex;
  } else {
    for (let i = segments.length - 1; i >= 0; i--) {
      const segment = segments[i];
      if (segment && contains(segment, clamped)) {
        index = i;
        break;
      }
    }
  }
  if (index === -1) {
    // Hole between two files: jump to the next file's start
    index = segments.findIndex((s) => s.offsetS > clamped);
    if (index === -1) index = segments.length - 1;
  }
  const segment = segments[index];
  if (!segment) return { index: 0, localS: 0 };
  return { index, localS: Math.min(Math.max(clamped - segment.offsetS, 0), segment.durationS) };
}
