import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { CameraVideoOutput } from 'react-native-vision-camera';

import { deleteFile } from '@/shared/native/files';

import { ClipRecorder } from './ClipRecorder';
import { SegmentRecorder } from './native/SegmentRecorder';

/**
 * Records one file per point while `recording` is true, on VisionCamera. The hook builds the
 * recorder with the phone's camera and files; the recorder does the work.
 */
export function useClipRecorder(videoOutput: CameraVideoOutput, recording: boolean) {
  const clips = useMemo(
    () =>
      new ClipRecorder({
        createRecorder: (events) => new SegmentRecorder(videoOutput, events),
        deleteFile,
      }),
    [videoOutput],
  );
  const stats = useSyncExternalStore(clips.stats.subscribe, clips.stats.get);

  useEffect(() => {
    if (recording) clips.start();
    else clips.stop();
  }, [clips, recording]);

  // Nothing outlives the match: every clip is deleted (GDPR).
  useEffect(() => () => clips.discard(), [clips]);

  return { stats, clips };
}
