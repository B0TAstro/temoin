import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  CommonResolutions,
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
  useMicrophonePermission,
  useVideoOutput,
  type CameraSessionConfig,
} from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';

import { replay as replayLog, type MatchView } from '@/core/events/matchLog';
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
import { buildJoinLink } from '@/features/session/joinLink';
import { decodeForm, toSetup } from '@/features/session/setup';
import { type Session, useGuestSession, useHostSession } from '@/features/session/useSession';
import { type VoiceStatus, useVoice } from '@/features/voice/useVoice';
import { Button } from '@/ui/Button';
import { useOrientation } from '@/ui/orientation';
import { QrCode } from '@/ui/QrCode';
import { colors, radius, touch } from '@/ui/theme';

const TARGET_FPS = 60;
const TARGET_BIT_RATE = 10_000_000;

type Tab = 'score' | 'training';
/** `forSeq`: the var-opened event this replay was frozen for. */
type Replay = { clips: ReplayClip[]; initialIndex: number; forSeq: number };

/** VAR clips, oldest first: the kept points, then what was filmed of the point in progress. */
function toReplay({ finished, current }: ClipsForReplay): Omit<Replay, 'forSeq'> {
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

/** Host (created the session) or guest (scanned its QR code): same screen, same code. */
export default function MatchRoute() {
  useOrientation('landscape');
  const params = useLocalSearchParams<{ role?: string; s?: string; form?: string }>();
  if (params.role === 'guest' && params.s) return <GuestMatch sessionId={params.s} />;
  return <HostMatch sessionId={params.s ?? 'SOLO'} rawForm={params.form} />;
}

function HostMatch({ sessionId, rawForm }: { sessionId: string; rawForm: string | undefined }) {
  const form = useMemo(() => decodeForm(rawForm), [rawForm]);
  const session = useHostSession(sessionId, form);
  if (!session.view) return null;
  return <MatchScreen session={{ ...session, view: session.view }} />;
}

function GuestMatch({ sessionId }: { sessionId: string }) {
  const session = useGuestSession(sessionId);
  if (!session.view || !session.form) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>
          {session.link === 'connecting'
            ? 'Connexion à l’hôte…'
            : `Recherche de la session ${sessionId}…`}
        </Text>
        <Text style={styles.hint}>Gardez les deux téléphones proches, Bluetooth activé.</Text>
        <Button label="Annuler" variant="outline" onPress={() => router.replace('/')} />
      </View>
    );
  }
  return <MatchScreen session={{ ...session, view: session.view }} />;
}

function linkLabel(session: Session): string {
  if (session.role === 'host') {
    if (session.link === 'off') return 'Bluetooth coupé · seul';
    return session.guests === 0
      ? 'Bluetooth ✓ · aucun invité'
      : `Bluetooth ✓ · ${session.guests} invité(s)`;
  }
  switch (session.link) {
    case 'connected':
      return 'Bluetooth ✓ · relié à l’hôte';
    case 'lost':
      return 'Lien perdu, l’enregistrement continue';
    default:
      return 'Recherche de l’hôte…';
  }
}

const VOICE_LABEL: Record<VoiceStatus, string> = {
  off: 'Voix coupée',
  starting: 'Chargement de la voix…',
  listening: 'À l’écoute de l’annonce',
  error: 'Voix indisponible',
};

/**
 * The match, in landscape: the camera and the session on the left, the score in the middle, the
 * match buttons on the right, under the thumb.
 */
function MatchScreen({ session }: { session: Session & { view: MatchView } }) {
  const { view, dispatch, log } = session;
  const { state, pending, points } = view;
  const [a, b] = state.config.sides;
  const setup = useMemo(() => toSetup(session.form ?? decodeForm(undefined)), [session.form]);

  useKeepAwake(); // otherwise the screen locks and the OS stops the camera
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  // Front: the players see the screen, and the score, from the court. Back: better picture.
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const device = useCameraDevice(facing);
  const appActive = useAppActive();
  const { fps, onFrameTimestamp, onFrameDropped } = useFpsMeter();
  const [selectedFps, setSelectedFps] = useState<number>();
  const [cameraRunning, setCameraRunning] = useState(false);
  const [tab, setTab] = useState<Tab>('score');
  const [replay, setReplay] = useState<Replay | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);

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

  // Recording pauses during the replay, to spare the phone (heat, battery).
  const matchOver = state.matchWonBy !== undefined;
  const cameraActive = !view.varOpen && appActive && !matchOver;
  const { stats, clips } = useClipRecorder(videoOutput, cameraRunning && cameraActive);

  // The voice listens while the camera films. Not during the replay: the players talking in front
  // of it must not count a point.
  const voice = useVoice({
    state,
    enabled: voiceOn && cameraRunning && cameraActive,
    onPoints: (winners) => dispatch({ type: 'point-called', winners, afterSeq: view.seq }),
  });

  // Every phone cuts its own file from the shared log, whoever pressed the button or heard the
  // call. A guest joining late skips what happened before it arrived.
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

  // VAR opens and closes on every phone at once; each one plays its own clip.
  const varSeq = view.varOpen ? (log.findLast((e) => e.type === 'var-opened')?.seq ?? 0) : 0;
  useEffect(() => {
    if (varSeq === 0) return;
    let cancelled = false;
    void clips.freeze().then((frozen) => {
      if (!cancelled) setReplay({ ...toReplay(frozen), forSeq: varSeq });
    });
    return () => {
      cancelled = true;
    };
  }, [varSeq, clips]);
  const shownReplay = varSeq !== 0 && replay?.forSeq === varSeq ? replay : null;

  const name = (side: SideId) => sideName(state, side);

  /** Training shortcut: the point counts at once, both sides agreeing. */
  const award = (winner: SideId) => {
    dispatch({ type: 'point-proposed', winner });
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

  /** The players decided: the outcome goes to the log, then every phone goes back to the score. */
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
    dispatch({ type: 'var-closed' });
  };

  const leave = () =>
    Alert.alert('Quitter le match ?', 'Les vidéos seront supprimées de ce téléphone.', [
      { text: 'Continuer', style: 'cancel' },
      { text: 'Quitter', style: 'destructive', onPress: () => router.replace('/') },
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
        <Text style={styles.message}>
          {facing === 'front' ? 'Aucune caméra avant.' : 'Aucune caméra arrière.'}
        </Text>
        <Button
          label="Changer de caméra"
          variant="outline"
          onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
        />
      </View>
    );
  }

  const canPropose = pending === undefined && !matchOver;
  const opening = view.varOpen && !shownReplay;
  const heardLine =
    voice.partial.length > 0
      ? `« ${voice.partial} »`
      : voice.heard
        ? `« ${voice.heard.text} » · ${voice.heard.result}`
        : null;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.side}>
          <View style={styles.preview}>
            <Camera
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={cameraActive}
              outputs={[videoOutput, frameOutput]}
              constraints={[{ fps: TARGET_FPS }, { resolutionBias: videoOutput }]}
              // The replay shows the court as it is: a mirrored clip would swap the lines.
              mirrorMode="off"
              onStarted={() => setCameraRunning(true)}
              onStopped={() => setCameraRunning(false)}
              onSessionConfigSelected={(config: CameraSessionConfig) =>
                setSelectedFps(config.selectedFPS)
              }
              resizeMode="cover"
            />
          </View>
          <Text style={[styles.rec, !stats.recording && styles.recOff]}>
            {stats.recording ? '● REC' : matchOver ? 'Match terminé' : 'Caméra en pause'}
          </Text>
          <Text style={styles.statusText}>{linkLabel(session)}</Text>
          <Text style={[styles.statusText, voice.status === 'listening' && styles.listening]}>
            {VOICE_LABEL[voice.status]}
          </Text>
          <View style={styles.tools}>
            {session.role === 'host' && (
              <IconButton
                icon="qr-code"
                label="Inviter un téléphone"
                onPress={() => setShowQr(true)}
              />
            )}
            <IconButton
              icon="camera-reverse"
              label={facing === 'back' ? 'Passer à la caméra avant' : 'Passer à la caméra arrière'}
              onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
            />
            <IconButton
              icon={voiceOn ? 'mic' : 'mic-off'}
              label={voiceOn ? 'Couper la voix' : 'Activer la voix'}
              onPress={() => setVoiceOn(!voiceOn)}
            />
            <IconButton icon="exit-outline" label="Quitter le match" onPress={leave} />
          </View>
          <View style={styles.tabs}>
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
          </View>
        </View>

        <View style={styles.middle}>
          {tab === 'score' ? (
            <View style={styles.board}>
              <ScoreDisplay state={state} />
              {heardLine !== null && (
                <Text style={styles.heard} numberOfLines={1}>
                  {heardLine}
                </Text>
              )}
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.training}>
              <Scoreboard state={state} />
              <View style={styles.stats}>
                <Text style={styles.statsText}>
                  {fps.toFixed(0)} fps mesurés · {selectedFps ?? '—'} configurés
                </Text>
                <Text style={styles.statsText}>
                  {stats.savedCount + 1} points gardés · {stats.totalMB.toFixed(0)} Mo ·{' '}
                  {stats.deletedCount} fichiers supprimés · {stats.errorCount} erreurs
                </Text>
                <Text style={styles.statsText}>
                  Session {session.sessionId} · {log.length} événements
                </Text>
                {voice.error !== undefined && (
                  <Text style={styles.statsText}>Voix : {voice.error}</Text>
                )}
              </View>
            </ScrollView>
          )}
        </View>

        <View style={styles.side}>
          {pending !== undefined ? (
            <PendingBanner
              winnerName={name(pending)}
              onConfirm={() => dispatch({ type: 'point-confirmed' })}
              onReject={() => dispatch({ type: 'point-rejected' })}
            />
          ) : tab === 'score' ? (
            [a, b].map((side) => (
              <Button
                key={side.id}
                label={`+1 ${name(side.id)}`}
                onPress={() => dispatch({ type: 'point-proposed', winner: side.id })}
                disabled={!canPropose}
                style={styles.action}
              />
            ))
          ) : (
            <>
              <Button
                label="Serveur"
                onPress={() => award(state.server)}
                disabled={!canPropose}
                style={styles.action}
              />
              <Button
                label="Relanceur"
                onPress={() => award(state.server === a.id ? b.id : a.id)}
                disabled={!canPropose}
                style={styles.action}
              />
            </>
          )}
          <Button
            label={opening ? '…' : 'VAR'}
            variant="var"
            onPress={() => dispatch({ type: 'var-opened' })}
            disabled={view.varOpen}
            style={styles.action}
          />
          <Button
            label="Annuler le point"
            variant="outline"
            onPress={undo}
            disabled={pending !== undefined || points.length === 0}
            style={styles.action}
          />
        </View>
      </SafeAreaView>

      {showQr && (
        <View style={styles.qrOverlay}>
          <QrCode value={buildJoinLink(session.sessionId)} size={240} />
          <View style={styles.qrText}>
            <Text style={styles.qrTitle}>Scannez pour rejoindre</Text>
            <Text style={styles.qrCode}>Session {session.sessionId}</Text>
            <Text style={styles.hint}>Sur l’autre téléphone : Témoin › Rejoindre une session</Text>
            <Button label="Fermer" variant="outline" onPress={() => setShowQr(false)} />
          </View>
        </View>
      )}

      {shownReplay && (
        <ReplayScreen
          clips={shownReplay.clips}
          initialIndex={shownReplay.initialIndex}
          fps={selectedFps ?? TARGET_FPS}
          sides={[
            { id: a.id, name: name(a.id) },
            { id: b.id, name: name(b.id) },
          ]}
          onOutcome={onOutcome}
          onClose={() => dispatch({ type: 'var-closed' })}
        />
      )}
    </View>
  );
}

/** A session setting, out of the way of the match buttons. */
function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: 'qr-code' | 'camera-reverse' | 'mic' | 'mic-off' | 'exit-outline';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.tool, pressed && styles.toolPressed]}
    >
      <Ionicons name={icon} size={24} color={colors.line} />
    </Pressable>
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
      <Ionicons name={active ? icon : `${icon}-outline`} size={24} color={color} />
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
  safe: { flex: 1, flexDirection: 'row', padding: 12, gap: 16 },
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
  side: { width: 220, gap: 10, justifyContent: 'center' },
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
  tool: {
    width: 48,
    height: 48,
    borderRadius: radius,
    backgroundColor: colors.inkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolPressed: { opacity: 0.5 },
  tabs: { flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4 },
  tabLabel: { fontSize: 14, fontWeight: '600' },
  middle: { flex: 1 },
  board: { flex: 1, justifyContent: 'center', gap: 12 },
  heard: { color: colors.lineDim, fontSize: 18, textAlign: 'center' },
  action: { minHeight: touch },
  training: { gap: 16, paddingVertical: 8 },
  stats: { backgroundColor: colors.inkSoft, borderRadius: radius, padding: 16, gap: 6 },
  statsText: { color: colors.line, fontSize: 15, fontVariant: ['tabular-nums'] },
  qrOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17,17,17,0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    padding: 24,
  },
  qrText: { gap: 16, maxWidth: 320 },
  qrTitle: { color: colors.line, fontSize: 28, fontWeight: '800' },
  qrCode: { color: colors.ball, fontSize: 28, fontWeight: '800', letterSpacing: 4 },
});
