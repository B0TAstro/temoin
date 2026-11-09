import { useEffect, useState } from 'react';
import {
  CommonResolutions,
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
  useMicrophonePermission,
  useVideoOutput,
} from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';

import { useFpsMeter } from '@/features/recording/useFpsMeter';

export const TARGET_FPS = 60;
const TARGET_BIT_RATE = 10_000_000;

/**
 * The match camera: permissions, front or back, and its two outputs (the video files, and the
 * frames that measure the real fps).
 */
export function useMatchCamera() {
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  // Front: the players see the screen, and the score, from the court. Back: better picture.
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const device = useCameraDevice(facing);
  const { fps, onFrameTimestamp, onFrameDropped } = useFpsMeter();
  const [selectedFps, setSelectedFps] = useState<number>();
  const [running, setRunning] = useState(false);

  // The microphone is asked once the camera is granted, so the two prompts do not overlap. Refused,
  // the video is simply silent.
  const microphone = useMicrophonePermission();
  const { hasPermission: micGranted, canRequestPermission: canAskMic } = microphone;
  const askMic = microphone.requestPermission;
  useEffect(() => {
    if (!hasPermission && canRequestPermission) requestPermission();
    else if (hasPermission && !micGranted && canAskMic) askMic();
  }, [hasPermission, canRequestPermission, requestPermission, micGranted, canAskMic, askMic]);

  const frameOutput = useFrameOutput({
    targetResolution: CommonResolutions.VGA_16_9,
    onFrame(frame) {
      'worklet';
      const timestamp = frame.timestamp;
      frame.dispose();
      scheduleOnRN(onFrameTimestamp, timestamp);
    },
    onFrameDropped,
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
    permission: { granted: hasPermission, canAsk: canRequestPermission, ask: requestPermission },
    facing,
    flip: () => setFacing(facing === 'back' ? 'front' : 'back'),
    device,
    frameOutput,
    videoOutput,
    /** Measured from the frames. */
    fps,
    /** What the camera session was configured with. */
    selectedFps,
    setSelectedFps,
    /** The camera is actually running (not just asked to). */
    running,
    setRunning,
  };
}

export type MatchCamera = ReturnType<typeof useMatchCamera>;
