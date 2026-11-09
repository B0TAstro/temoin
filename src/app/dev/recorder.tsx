import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  CommonResolutions,
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
  useVideoOutput,
  type CameraSessionConfig,
} from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';

import type { Segment } from '@/core/clips/Segment';
import { deleteFile, SegmentRecorder } from '@/adapters/camera/SegmentRecorder';
import { useFpsMeter } from '@/features/recording/useFpsMeter';

/**
 * Spike R1: does VisionCamera's persistent recorder cut one file per point, in .mp4, at 60 fps, on
 * this phone, and how long is the gap at the cut? "Fin du point" cuts like a scored point would.
 */
const TARGET_FPS = 60;
const BIT_RATES = [undefined, 10_000_000, 6_000_000] as const;
type BitRate = (typeof BIT_RATES)[number];

type Stats = {
  files: number;
  totalBytes: number;
  lastOverlapMs?: number;
  minOverlapMs?: number;
  gaps: number;
  errors: number;
  last?: Segment;
};

const EMPTY_STATS: Stats = { files: 0, totalBytes: 0, gaps: 0, errors: 0 };

const bitRateLabel = (bitRate: BitRate) =>
  bitRate == null ? 'Auto' : `${bitRate / 1_000_000} Mbit/s`;
const mb = (bytes: number) => (bytes / 1_000_000).toFixed(1);
const extension = (path: string) => path.split('.').pop() ?? '?';

function useAppActive() {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setActive(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  return active;
}

export default function RecorderSpike() {
  useKeepAwake();
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const appActive = useAppActive();
  const { fps, droppedCount, onFrameTimestamp, onFrameDropped } = useFpsMeter();
  const [selectedFps, setSelectedFps] = useState<number>();
  const [cameraRunning, setCameraRunning] = useState(false);
  const [bitRate, setBitRate] = useState<BitRate>(undefined);
  const [recording, setRecording] = useState(false);
  const [startedAt, setStartedAt] = useState<number>();
  const [now, setNow] = useState(() => Date.now());
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const recorder = useRef<SegmentRecorder | null>(null);
  const files = useRef<string[]>([]);

  useEffect(() => {
    if (!hasPermission && canRequestPermission) requestPermission();
  }, [hasPermission, canRequestPermission, requestPermission]);

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
    ...(bitRate != null && { targetBitRate: bitRate }),
  });

  // A new output (other bit rate) needs a new recorder.
  useEffect(() => {
    const instance = new SegmentRecorder(videoOutput, (segment) => {
      files.current.push(segment.path);
      setStats((previous) => {
        const overlap = instance.lastOverlapMs;
        return {
          files: previous.files + 1,
          totalBytes: previous.totalBytes + segment.sizeBytes,
          gaps: previous.gaps + (overlap != null && overlap < 0 ? 1 : 0),
          errors: instance.errorCount,
          last: segment,
          ...(overlap != null && {
            lastOverlapMs: overlap,
            minOverlapMs: Math.min(previous.minOverlapMs ?? overlap, overlap),
          }),
        };
      });
    });
    recorder.current = instance;
    return () => instance.cancel();
  }, [videoOutput]);

  useEffect(() => {
    if (!recording) return;
    const tick = setInterval(() => {
      setNow(Date.now());
      // Errors can happen without any file finishing (recorder that fails to start).
      const errors = recorder.current?.errorCount ?? 0;
      setStats((previous) => (previous.errors === errors ? previous : { ...previous, errors }));
    }, 1000);
    return () => clearInterval(tick);
  }, [recording]);

  const start = () => {
    setStats(EMPTY_STATS);
    setStartedAt(Date.now());
    setNow(Date.now());
    recorder.current?.start();
    setRecording(true);
  };

  // The controls come back only once the last file is written: no second recording on Android.
  const stop = async () => {
    await recorder.current?.stop();
    setRecording(false);
  };

  const clear = () => {
    for (const path of files.current) deleteFile(path);
    files.current = [];
    setStats(EMPTY_STATS);
    setStartedAt(undefined);
  };

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Témoin a besoin de la caméra.</Text>
        {canRequestPermission && (
          <Pressable style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Autoriser</Text>
          </Pressable>
        )}
      </View>
    );
  }
  if (device == null) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Aucune caméra arrière.</Text>
      </View>
    );
  }

  const elapsedMin = startedAt != null ? (now - startedAt) / 60_000 : 0;
  const mbPerMin = elapsedMin > 0.05 ? stats.totalBytes / 1_000_000 / elapsedMin : undefined;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.preview}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={appActive}
          outputs={[videoOutput, frameOutput]}
          constraints={[{ fps: TARGET_FPS }, { resolutionBias: videoOutput }]}
          onStarted={() => setCameraRunning(true)}
          onStopped={() => setCameraRunning(false)}
          onSessionConfigSelected={(config: CameraSessionConfig) =>
            setSelectedFps(config.selectedFPS)
          }
          resizeMode="cover"
        />
      </View>
      <ScrollView contentContainerStyle={styles.panel}>
        <Text style={styles.title}>Test enregistreur · {Platform.OS} · un fichier par point</Text>
        <View style={styles.row}>
          {BIT_RATES.map((option) => (
            <Pressable
              key={bitRateLabel(option)}
              disabled={recording}
              onPress={() => setBitRate(option)}
              style={[styles.chip, option === bitRate && styles.chipSelected]}
            >
              <Text style={[styles.chipText, option === bitRate && styles.chipTextSelected]}>
                {bitRateLabel(option)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.text, fps < TARGET_FPS - 5 && styles.warning]}>
          {fps.toFixed(0)} fps mesurés · {selectedFps ?? '—'} configurés · {droppedCount} images
          perdues
        </Text>
        <Text style={styles.text}>
          {stats.files} fichiers · {mb(stats.totalBytes)} Mo
          {mbPerMin != null && ` · ${mbPerMin.toFixed(0)} Mo/min`} · {elapsedMin.toFixed(1)} min
        </Text>
        <Text style={[styles.text, stats.gaps > 0 && styles.warning]}>
          À la coupe (approximatif) : dernier {stats.lastOverlapMs ?? '—'} ms · pire{' '}
          {stats.minOverlapMs ?? '—'} ms · {stats.gaps} trous (négatif = images perdues entre deux
          points)
        </Text>
        <Text style={[styles.text, stats.errors > 0 && styles.warning]}>
          {stats.errors} erreurs
          {stats.last != null &&
            ` · dernier fichier .${extension(stats.last.path)}, ${stats.last.durationS.toFixed(1)} s, ${mb(stats.last.sizeBytes)} Mo`}
        </Text>
        <View style={styles.row}>
          {recording ? (
            <>
              <Pressable style={styles.pointButton} onPress={() => recorder.current?.cut()}>
                <Text style={styles.pointButtonText}>Fin du point</Text>
              </Pressable>
              <Pressable style={styles.buttonOutline} onPress={stop}>
                <Text style={styles.buttonOutlineText}>Arrêter</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              style={[styles.button, !cameraRunning && styles.disabled]}
              disabled={!cameraRunning}
              onPress={start}
            >
              <Text style={styles.buttonText}>Enregistrer</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.buttonOutline, recording && styles.disabled]}
            disabled={recording}
            onPress={clear}
          >
            <Text style={styles.buttonOutlineText}>Effacer les fichiers</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111111' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: '#111111',
  },
  preview: { height: 220, backgroundColor: '#000000' },
  panel: { padding: 16, gap: 12 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  text: { color: '#FFFFFF', fontSize: 16, fontVariant: ['tabular-nums'] },
  warning: { color: '#E9B44C' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  chip: { borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 16, padding: 12 },
  chipSelected: { backgroundColor: '#FFFFFF' },
  chipText: { color: '#FFFFFF', fontSize: 16 },
  chipTextSelected: { color: '#111111' },
  button: { backgroundColor: '#3E7A57', borderRadius: 16, padding: 16, minWidth: 140 },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  pointButton: { backgroundColor: '#E9B44C', borderRadius: 16, padding: 24, minWidth: 200 },
  pointButtonText: { color: '#111111', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  buttonOutline: { borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 16, padding: 16 },
  buttonOutlineText: { color: '#FFFFFF', fontSize: 18, textAlign: 'center' },
  disabled: { opacity: 0.4 },
});
