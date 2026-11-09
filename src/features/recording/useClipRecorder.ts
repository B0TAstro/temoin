import { useEffect, useMemo, useState } from 'react';
import type { CameraVideoOutput } from 'react-native-vision-camera';

import { ClipRecorder, type ClipStats } from './ClipRecorder';

/** Records one file per point while `recording` is true, and exposes stats for the screen. */
export function useClipRecorder(videoOutput: CameraVideoOutput, recording: boolean) {
  const clips = useMemo(() => new ClipRecorder(videoOutput), [videoOutput]);
  const [stats, setStats] = useState<ClipStats>(() => clips.getStats());

  useEffect(() => {
    if (recording) clips.start();
    else clips.stop();
  }, [clips, recording]);

  useEffect(() => {
    const id = setInterval(() => setStats(clips.getStats()), 500);
    return () => {
      clearInterval(id);
      // Nothing outlives the match: every clip is deleted (GDPR).
      clips.discard();
    };
  }, [clips]);

  return { stats, clips };
}
