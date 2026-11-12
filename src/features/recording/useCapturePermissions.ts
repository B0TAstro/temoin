import { useEffect } from 'react';
import { useCameraPermission, useMicrophonePermission } from 'react-native-vision-camera';

/**
 * Camera then microphone, asked one after the other so the two prompts do not overlap.
 * Microphone refused: the video is simply silent
 */
export function useCapturePermissions() {
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const microphone = useMicrophonePermission();
  const { hasPermission: micGranted, canRequestPermission: canAskMic } = microphone;
  const askMic = microphone.requestPermission;
  useEffect(() => {
    if (!hasPermission && canRequestPermission) requestPermission();
    else if (hasPermission && !micGranted && canAskMic) askMic();
  }, [hasPermission, canRequestPermission, requestPermission, micGranted, canAskMic, askMic]);

  return {
    camera: { granted: hasPermission, canAsk: canRequestPermission, ask: requestPermission },
    micGranted,
  };
}
