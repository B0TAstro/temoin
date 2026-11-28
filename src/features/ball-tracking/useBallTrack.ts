import { useEffect, useState, useSyncExternalStore } from 'react';

import type { Timeline } from '@/features/recording';
import type { Court } from '@/sports/tennis';

import { ballConfigFor } from './logic/ballConfigFor';
import { nativeClipFrames } from './native/ClipFrames';
import { createOpenCvDetector } from './native/OpenCvDetector';
import { type BallTrackState, ReplayBallTracker } from './ReplayBallTracker';

/**
 * The ball tracking of the point on screen: an on/off switch, and the time on screen to follow.
 * The tracker does the work; this only wires it to React. Leaving the point stops it. The court
 * is the session's: it picks the settings once, when the point opens. `inPlay`: the calibrated
 * court and its margin, where the ball is looked for (everywhere without a calibration).
 */
export function useBallTrack(
  timeline: Timeline,
  timeS: number,
  court: Court,
  inPlay: ((point: { x: number; y: number }) => boolean) | undefined,
): BallTrackState & { toggle: () => void } {
  const [tracker] = useState(() => {
    const config = ballConfigFor(court);
    return new ReplayBallTracker(
      timeline,
      nativeClipFrames,
      createOpenCvDetector(config),
      config,
      inPlay,
    );
  });
  const state = useSyncExternalStore(tracker.store.subscribe, tracker.store.get);
  useEffect(() => () => tracker.stop(), [tracker]);
  useEffect(() => {
    if (state.on) tracker.follow(timeS);
  }, [tracker, state.on, timeS]);
  return { ...state, toggle: () => tracker.setOn(!state.on) };
}
