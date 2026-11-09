import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

import { scoreLabel, sideName } from '@/core/score/labels';
import type { SideId } from '@/core/score/types';
import type { ClipsForReplay } from '@/features/recording/ClipRecorder';
import { useAppActive } from '@/features/recording/useAppActive';
import { useClipRecorder } from '@/features/recording/useClipRecorder';
import { useFpsMeter } from '@/features/recording/useFpsMeter';
import { type ReplayClip, type ReplayOutcome, ReplayScreen } from '@/features/replay/ReplayScreen';
import { PendingBanner } from '@/features/score/PendingBanner';
import { ScoreDisplay } from '@/features/score/ScoreDisplay';
import { Scoreboard } from '@/features/score/Scoreboard';
import { decodeForm, toSetup } from '@/features/session/setup';
import { useMatch } from '@/features/session/useMatch';
import { Button } from '@/ui/Button';
import { colors, radius } from '@/ui/theme';

const TARGET_FPS = 60;
const TARGET_BIT_RATE = 10_000_000;

type Tab = 'score' | 'training';
type Replay = { clips: ReplayClip[]; initialIndex: number };

/** VAR clips, oldest first: the kept points, then what was filmed of the point in progress. */
function toReplay({ finished, current }: ClipsForReplay): Replay {
  const clips: ReplayClip[] = [...finished].reverse().map((clip, i, all) => ({
    key: `clip-${clip.id}`,
    title: clip.point?.label ?? '',
    subtitle: i === all.length - 1 ? 'Dernier point' : 'Point précédent',
    segments: clip.segments,
  }));
  if (current.segments.length > 0 || clips.length === 0) {
    clips.push({
      key: `clip-${current.id}`,
      title: 'Point en cours',
      subtitle: 'En cours',
      segments: current.segments,
    });
  }
  return { clips, initialIndex: Math.max(0, finished.length - 1) };
}

/** The match: the score read from a distance, the camera filming one file per point. */
export default function MatchScreen() {
  const params = useLocalSearchParams<{ form?: string }>();
  const setup = useMemo(() => toSetup(decodeForm(params.form)), [params.form]);
  const match = useMatch(setup);
  const { state, pending, points, dispatch } = match;
  const [a, b] = state.config.sides;

  useKeepAwake(); // otherwise the screen locks and the OS stops the camera
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const appActive = useAppActive();
  const { fps, onFrameTimestamp, onFrameDropped } = useFpsMeter();
  const [selectedFps, setSelectedFps] = useState<number>();
  const [cameraRunning, setCameraRunning] = useState(false);
  const [tab, setTab] = useState<Tab>('score');
  const [replay, setReplay] = useState<Replay | null>(null);
  const [freezing, setFreezing] = useState(false);

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
    targetBitRate: TARGET_BIT_RATE,
  });

  // Recording pauses during the replay, to spare the phone (heat, battery).
  const matchOver = state.matchWonBy !== undefined;
  const cameraActive = replay == null && appActive && !matchOver;
  const { stats, clips } = useClipRecorder(videoOutput, cameraRunning && cameraActive);

  const name = (side: SideId) => sideName(state, side);

  const propose = (winner: SideId) => {
    if (!dispatch({ type: 'point-proposed', winner })) return;
    // The file is cut at the proposal, as close as possible to the end of the rally.
    clips.endPoint({ pointIndex: points.length, label: scoreLabel(state) });
  };

  const reject = () => {
    if (dispatch({ type: 'point-rejected' })) clips.retract();
  };

  /** Training shortcut: the point counts at once, both sides agreeing. */
  const award = (winner: SideId) => {
    propose(winner);
    dispatch({ type: 'point-confirmed' });
  };

  const undo = () =>
    Alert.alert('Annuler le dernier point ?', 'Le score revient au point précédent.', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Annuler le point',
        style: 'destructive',
        onPress: () => dispatch({ type: 'point-undone' }),
      },
    ]);

  const openVar = async () => {
    if (freezing || replay) return;
    setFreezing(true);
    // Writes the file in progress so the replay contains the moment of the press.
    setReplay(toReplay(await clips.freeze()));
    setFreezing(false);
  };

  /** The players decided: the outcome goes to the log, then back to the score. */
  const onOutcome = (outcome: ReplayOutcome) => {
    if (pending !== undefined) {
      dispatch(
        outcome.kind === 'point'
          ? { type: 'point-confirmed', winner: outcome.winner }
          : { type: 'point-rejected' },
      );
    } else if (outcome.kind === 'point') {
      if (points.at(-1) !== outcome.winner)
        dispatch({ type: 'point-corrected', winner: outcome.winner });
    } else {
      dispatch({ type: 'point-undone' });
    }
    setReplay(null);
  };

  const leave = () =>
    Alert.alert('Terminer le match ?', 'Les vidéos seront supprimées de ce téléphone.', [
      { text: 'Continuer', style: 'cancel' },
      { text: 'Terminer', style: 'destructive', onPress: () => router.replace('/') },
    ]);

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Témoin a besoin de la caméra pour filmer les points.</Text>
        {canRequestPermission ? (
          <Button label="Autoriser" onPress={requestPermission} />
        ) : (
          <Text style={styles.hint}>Autorisez-la dans Réglages › Témoin.</Text>
        )}
      </View>
    );
  }
  if (device == null) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Aucune caméra arrière.</Text>
      </View>
    );
  }

  const recording = stats.recording;
  const canPropose = pending === undefined && !matchOver;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <View style={[styles.preview, tab === 'training' && styles.previewLarge]}>
            <Camera
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={cameraActive}
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
          <View style={styles.status}>
            <Text style={[styles.rec, !recording && styles.recOff]}>
              {recording ? '● REC' : matchOver ? 'Match terminé' : 'Caméra en pause'}
            </Text>
            <Text style={styles.statusText}>Seul · {scoreLabel(state)}</Text>
            <Pressable onPress={leave} hitSlop={12}>
              <Text style={styles.leave}>Terminer le match</Text>
            </Pressable>
          </View>
        </View>

        {tab === 'score' ? (
          <View style={styles.body}>
            <View style={styles.board}>
              <ScoreDisplay state={state} />
            </View>
            {pending !== undefined ? (
              <PendingBanner
                winnerName={name(pending)}
                onConfirm={() => dispatch({ type: 'point-confirmed' })}
                onReject={reject}
              />
            ) : (
              <View style={styles.row}>
                {[a, b].map((side) => (
                  <Button
                    key={side.id}
                    label={`+1 ${name(side.id)}`}
                    onPress={() => propose(side.id)}
                    disabled={!canPropose}
                    style={styles.flex}
                  />
                ))}
              </View>
            )}
            <View style={styles.row}>
              <Button
                label={freezing ? '…' : 'VAR'}
                variant="var"
                onPress={openVar}
                disabled={freezing}
                style={styles.flex}
              />
              <Button
                label="Annuler le point"
                variant="outline"
                onPress={undo}
                disabled={pending !== undefined || points.length === 0}
                style={styles.flex}
              />
            </View>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.training}>
            <Scoreboard state={state} />
            <Text style={styles.sectionTitle}>Point gagné par</Text>
            <View style={styles.row}>
              <Button
                label="Serveur"
                onPress={() => award(state.server)}
                disabled={!canPropose}
                style={styles.flex}
              />
              <Button
                label="Relanceur"
                onPress={() => award(state.server === a.id ? b.id : a.id)}
                disabled={!canPropose}
                style={styles.flex}
              />
            </View>
            <Button
              label="Annuler le dernier point"
              variant="outline"
              onPress={undo}
              disabled={pending !== undefined || points.length === 0}
            />
            <View style={styles.stats}>
              <Text style={styles.statsText}>
                {fps.toFixed(0)} fps mesurés · {selectedFps ?? '—'} configurés
              </Text>
              <Text style={styles.statsText}>
                {stats.savedCount + 1} points gardés · {stats.totalMB.toFixed(0)} Mo ·{' '}
                {stats.deletedCount} fichiers supprimés · {stats.errorCount} erreurs
              </Text>
              <Text style={styles.statsText}>{match.log.length} événements dans le journal</Text>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.tabBar}>
        <TabButton
          label="Score"
          icon="tennisball"
          active={tab === 'score'}
          onPress={() => setTab('score')}
        />
        <TabButton
          label="Entraînement"
          icon="barbell"
          active={tab === 'training'}
          onPress={() => setTab('training')}
        />
      </SafeAreaView>

      {replay && (
        <ReplayScreen
          clips={replay.clips}
          initialIndex={replay.initialIndex}
          fps={selectedFps ?? TARGET_FPS}
          sides={[
            { id: a.id, name: name(a.id) },
            { id: b.id, name: name(b.id) },
          ]}
          onOutcome={onOutcome}
          onClose={() => setReplay(null)}
        />
      )}
    </View>
  );
}

function TabButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: 'tennisball' | 'barbell';
  active: boolean;
  onPress: () => void;
}) {
  const color = active ? colors.ball : colors.lineDim;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={styles.tab}
    >
      <Ionicons name={active ? icon : `${icon}-outline`} size={28} color={color} />
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
  safe: { flex: 1, paddingHorizontal: 16, gap: 16 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 24,
    backgroundColor: colors.ink,
  },
  message: { color: colors.line, fontSize: 22, textAlign: 'center' },
  hint: { color: colors.lineDim, fontSize: 18, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 8 },
  preview: {
    width: 90,
    height: 120,
    borderRadius: radius,
    overflow: 'hidden',
    backgroundColor: colors.inkSoft,
  },
  previewLarge: { width: 160, height: 220 },
  status: { flex: 1, gap: 8 },
  rec: { color: colors.ball, fontSize: 18, fontWeight: '800' },
  recOff: { color: colors.lineDim },
  statusText: { color: colors.line, fontSize: 16 },
  leave: { color: colors.lineDim, fontSize: 16, textDecorationLine: 'underline' },
  body: { flex: 1, gap: 16, paddingBottom: 16 },
  board: { flex: 1, justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 16 },
  flex: { flex: 1 },
  training: { gap: 16, paddingBottom: 24 },
  sectionTitle: { color: colors.lineDim, fontSize: 16 },
  stats: { backgroundColor: colors.inkSoft, borderRadius: radius, padding: 16, gap: 6 },
  statsText: { color: colors.line, fontSize: 16, fontVariant: ['tabular-nums'] },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.2)',
    backgroundColor: colors.inkSoft,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingBottom: 4 },
  tabLabel: { fontSize: 16, fontWeight: '600' },
});
