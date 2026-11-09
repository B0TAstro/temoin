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
import { Button } from '@/ui/Button';
import { QrCode } from '@/ui/QrCode';
import { colors, radius } from '@/ui/theme';

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

/** The match: the score read from a distance, the camera filming one file per point. */
function MatchScreen({ session }: { session: Session & { view: MatchView } }) {
  const { view, dispatch, log } = session;
  const { state, pending, points } = view;
  const [a, b] = state.config.sides;
  const setup = useMemo(() => toSetup(session.form ?? decodeForm(undefined)), [session.form]);

  useKeepAwake(); // otherwise the screen locks and the OS stops the camera
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const appActive = useAppActive();
  const { fps, onFrameTimestamp, onFrameDropped } = useFpsMeter();
  const [selectedFps, setSelectedFps] = useState<number>();
  const [cameraRunning, setCameraRunning] = useState(false);
  const [tab, setTab] = useState<Tab>('score');
  const [replay, setReplay] = useState<Replay | null>(null);
  const [showQr, setShowQr] = useState(false);

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
  const cameraActive = !view.varOpen && appActive && !matchOver;
  const { stats, clips } = useClipRecorder(videoOutput, cameraRunning && cameraActive);

  // Every phone cuts its own file from the shared log, whoever pressed the button. A guest
  // joining late skips what happened before it arrived.
  const processed = useRef(log.length);
  useEffect(() => {
    for (let i = processed.current; i < log.length; i++) {
      const event = log[i];
      if (event?.type === 'point-proposed') {
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
        <Text style={styles.message}>Aucune caméra arrière.</Text>
      </View>
    );
  }

  const canPropose = pending === undefined && !matchOver;
  const opening = view.varOpen && !shownReplay;

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
            <Text style={[styles.rec, !stats.recording && styles.recOff]}>
              {stats.recording ? '● REC' : matchOver ? 'Match terminé' : 'Caméra en pause'}
            </Text>
            <Text style={styles.statusText}>{linkLabel(session)}</Text>
            <View style={styles.links}>
              {session.role === 'host' && (
                <Pressable onPress={() => setShowQr(true)} hitSlop={12}>
                  <Text style={styles.link}>Inviter un téléphone</Text>
                </Pressable>
              )}
              <Pressable onPress={leave} hitSlop={12}>
                <Text style={styles.link}>Quitter</Text>
              </Pressable>
            </View>
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
                onReject={() => dispatch({ type: 'point-rejected' })}
              />
            ) : (
              <View style={styles.row}>
                {[a, b].map((side) => (
                  <Button
                    key={side.id}
                    label={`+1 ${name(side.id)}`}
                    onPress={() => dispatch({ type: 'point-proposed', winner: side.id })}
                    disabled={!canPropose}
                    style={styles.flex}
                  />
                ))}
              </View>
            )}
            <View style={styles.row}>
              <Button
                label={opening ? '…' : 'VAR'}
                variant="var"
                onPress={() => dispatch({ type: 'var-opened' })}
                disabled={view.varOpen}
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
              <Text style={styles.statsText}>
                Session {session.sessionId} · {log.length} événements
              </Text>
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

      {showQr && (
        <View style={styles.qrOverlay}>
          <Text style={styles.qrTitle}>Scannez pour rejoindre</Text>
          <QrCode value={buildJoinLink(session.sessionId)} size={260} />
          <Text style={styles.qrCode}>Session {session.sessionId}</Text>
          <Text style={styles.hint}>Sur l’autre téléphone : Témoin › Rejoindre une session</Text>
          <Button label="Fermer" variant="outline" onPress={() => setShowQr(false)} />
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
  links: { flexDirection: 'row', gap: 24 },
  link: { color: colors.lineDim, fontSize: 16, textDecorationLine: 'underline' },
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
  qrOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17,17,17,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    padding: 24,
  },
  qrTitle: { color: colors.line, fontSize: 28, fontWeight: '800' },
  qrCode: { color: colors.ball, fontSize: 28, fontWeight: '800', letterSpacing: 4 },
});
