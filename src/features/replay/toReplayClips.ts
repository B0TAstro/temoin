import type { ClipsForReplay } from '@/features/recording/ClipRecorder';

import type { ReplayClip } from './ReplayScreen';

export type ReplayClips = { clips: ReplayClip[]; initialIndex: number };

/** VAR clips, oldest first: the kept points, then what was filmed of the point in progress. */
export function toReplayClips({ finished, current }: ClipsForReplay): ReplayClips {
  const clips: ReplayClip[] = [...finished].reverse().map((clip, i, all) => ({
    key: `clip-${clip.id}`,
    title: clip.point?.label ?? '',
    subtitle: i === all.length - 1 ? 'Dernier point' : 'Point précédent',
    segments: clip.segments,
  }));
  if (current.segments.length > 0 || clips.length === 0) {
    clips.push({
      key: `clip-${current.id}`,
      title: 'Point en cours',
      subtitle: 'En cours',
      segments: current.segments,
    });
  }
  return { clips, initialIndex: Math.max(0, finished.length - 1) };
}
