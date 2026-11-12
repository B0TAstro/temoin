import { useEffect, useRef } from 'react';

import { type LoggedEvent, replayLog } from '@/features/session';
import { type MatchSetup, scoreLabel } from '@/sports/tennis';

import type { ClipRecorder } from './ClipRecorder';

/**
 * Every phone cuts its own file from the shared log, whoever pressed the button or heard the call:
 * a proposed or called point ends the clip, a rejected one gives it back to the point that goes on
 */
export function useClipsFromLog(
  log: readonly LoggedEvent[],
  setup: MatchSetup,
  clips: ClipRecorder,
) {
  const processed = useRef(log.length);
  useEffect(() => {
    for (let i = processed.current; i < log.length; i++) {
      const event = log[i];
      if (event?.type === 'point-proposed' || event?.type === 'point-called') {
        const before = replayLog(setup, log.slice(0, i));
        clips.endPoint({ pointIndex: before.points.length, label: scoreLabel(before.state) });
      } else if (event?.type === 'point-rejected') {
        clips.retract();
      }
    }
    processed.current = log.length;
  }, [log, setup, clips]);
}
