import { useEffect, useState } from 'react';

import type { LoggedEvent, MatchView } from '@/features/session';
import type { ClipRecorder } from '@/features/recording';

import { type ReplayClips, toReplayClips } from './toReplayClips';

/** `forSeq`: the var-opened event these clips were frozen for. */
type Frozen = ReplayClips & { forSeq: number };

/**
 * VAR opens and closes on every phone at once, from the shared log; each one plays its own clips.
 * Null while the replay is closed, and while the clips are still being written.
 */
export function useVarReplay(
  view: MatchView,
  log: readonly LoggedEvent[],
  clips: ClipRecorder,
): ReplayClips | null {
  const [frozen, setFrozen] = useState<Frozen | null>(null);
  const varSeq = view.varOpen ? (log.findLast((e) => e.type === 'var-opened')?.seq ?? 0) : 0;

  useEffect(() => {
    if (varSeq === 0) return;
    let cancelled = false;
    void clips.freeze().then((clipsForReplay) => {
      if (!cancelled) setFrozen({ ...toReplayClips(clipsForReplay), forSeq: varSeq });
    });
    return () => {
      cancelled = true;
    };
  }, [varSeq, clips]);

  return varSeq !== 0 && frozen?.forSeq === varSeq ? frozen : null;
}
