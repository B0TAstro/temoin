import { useState } from 'react';
import {
  CommonResolutions,
  useCameraDevice,
  useFrameOutput,
  useVideoOutput,
} from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';

import { useCapturePermissions } from './useCapturePermissions';
import { useFpsMeter } from './useFpsMeter';

export const TARGET_FPS = 60;
const TARGET_BIT_RATE = 10_000_000;

/**
 * The match camera: its permissions, front or back, and its two outputs
 */
export function useMatchCamera() {
  const { camera, micGranted } = useCapturePermissions();
  // Front: the players see the screen, and the score, from the court. Back: better picture...
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const device = useCameraDevice(facing);
  const { fps, onFrameTimestamp } = useFpsMeter();
  const [selectedFps, setSelectedFps] = useState<number>();
  const [running, setRunning] = useState(false);

  // Frames are only counted, to show the real fps on screen
  const frameOutput = useFrameOutput({
    targetResolution: CommonResolutions.VGA_16_9,
    onFrame(frame) {
      'worklet';
      const timestamp = frame.timestamp;
      frame.dispose();
      scheduleOnRN(onFrameTimestamp, timestamp);
    },
  });
  const videoOutput = useVideoOutput({
    targetResolution: CommonResolutions.HD_16_9,
    enablePersistentRecorder: true,
    fileType: 'mp4',
    targetBitRate: TARGET_BIT_RATE,
    // The sound of the rally helps read the replay, and its peaks are marked on the timeline.
    enableAudio: micGranted,
  });

  return {
    permission: camera,
    facing,
    flip: () => setFacing(facing === 'back' ? 'front' : 'back'),
    device,
    frameOutput,
    videoOutput,
    fps,
    selectedFps,
    setSelectedFps,
    running,
    setRunning,
  };
}

export type MatchCamera = ReturnType<typeof useMatchCamera>;
