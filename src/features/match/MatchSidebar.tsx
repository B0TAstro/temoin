import { StyleSheet, Text, View } from 'react-native';
import { Camera, type CameraDevice, type CameraSessionConfig } from 'react-native-vision-camera';

import type { VoiceStatus } from '@/features/voice/useVoice';
import { VOICE_LABEL } from '@/features/voice/voiceLabels';
import { IconButton } from '@/shared/ui/IconButton';
import { TabButton } from '@/shared/ui/TabButton';
import { colors, radius } from '@/shared/ui/theme';

import type { MatchTab } from './MatchControls';
import { type MatchCamera, TARGET_FPS } from './useMatchCamera';

/**
 * The left column: the camera preview, what the phone is doing (recording, link, voice), the
 * session settings and the tabs.
 */
export function MatchSidebar({
  camera,
  device,
  cameraActive,
  recording,
  matchOver,
  linkText,
  voiceStatus,
  voiceOn,
  onToggleVoice,
  onInvite,
  onLeave,
  tab,
  onTab,
}: {
  camera: MatchCamera;
  device: CameraDevice;
  cameraActive: boolean;
  recording: boolean;
  matchOver: boolean;
  linkText: string;
  voiceStatus: VoiceStatus;
  voiceOn: boolean;
  onToggleVoice: () => void;
  /** Host only: shows the QR code. */
  onInvite: (() => void) | undefined;
  onLeave: () => void;
  tab: MatchTab;
  onTab: (tab: MatchTab) => void;
}) {
  return (
    <>
      <View style={styles.preview}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={cameraActive}
          outputs={[camera.videoOutput, camera.frameOutput]}
          constraints={[{ fps: TARGET_FPS }, { resolutionBias: camera.videoOutput }]}
          // The replay shows the court as it is: a mirrored clip would swap the lines.
          mirrorMode="off"
          onStarted={() => camera.setRunning(true)}
          onStopped={() => camera.setRunning(false)}
          onSessionConfigSelected={(config: CameraSessionConfig) =>
            camera.setSelectedFps(config.selectedFPS)
          }
          resizeMode="cover"
        />
      </View>
      <Text style={[styles.rec, !recording && styles.recOff]}>
        {recording ? '● REC' : matchOver ? 'Match terminé' : 'Caméra en pause'}
      </Text>
      <Text style={styles.statusText}>{linkText}</Text>
      <Text style={[styles.statusText, voiceStatus === 'listening' && styles.listening]}>
        {VOICE_LABEL[voiceStatus]}
      </Text>
      <View style={styles.tools}>
        {onInvite && <IconButton icon="qr-code" label="Inviter un téléphone" onPress={onInvite} />}
        <IconButton
          icon="camera-reverse"
          label={
            camera.facing === 'back' ? 'Passer à la caméra avant' : 'Passer à la caméra arrière'
          }
          onPress={camera.flip}
        />
        <IconButton
          icon={voiceOn ? 'mic' : 'mic-off'}
          label={voiceOn ? 'Couper la voix' : 'Activer la voix'}
          onPress={onToggleVoice}
        />
        <IconButton icon="exit-outline" label="Quitter le match" onPress={onLeave} />
      </View>
      <View style={styles.tabs}>
        <TabButton
          label="Score"
          icon="tennisball"
          inactiveIcon="tennisball-outline"
          active={tab === 'score'}
          onPress={() => onTab('score')}
        />
        <TabButton
          label="Entraînement"
          icon="barbell"
          inactiveIcon="barbell-outline"
          active={tab === 'training'}
          onPress={() => onTab('training')}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  preview: {
    width: 220,
    aspectRatio: 16 / 9,
    borderRadius: radius,
    overflow: 'hidden',
    backgroundColor: colors.inkSoft,
  },
  rec: { color: colors.ball, fontSize: 18, fontWeight: '800' },
  recOff: { color: colors.lineDim },
  statusText: { color: colors.line, fontSize: 15 },
  listening: { color: colors.ball },
  tools: { flexDirection: 'row', justifyContent: 'space-between' },
  tabs: { flexDirection: 'row' },
});
