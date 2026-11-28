import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BallHud, BallTrackOverlay, useLiveBallTrack } from '@/features/ball-tracking';
import { useCourtCalibration } from '@/features/court';
import { useClipRecorder, useClipsFromLog, useMatchCamera } from '@/features/recording';
import { outcomeEvents, ReplayScreen, useVarReplay, varSummary } from '@/features/replay';
import { type PointControls, ScoreDisplay } from '@/features/score';
import { InviteOverlay, linkStatus, type MatchSession } from '@/features/session';
import { appSettings, SettingsScreen } from '@/features/settings';
import { heardLine, useVoice } from '@/features/voice';
import { useAppActive } from '@/shared/native/useAppActive';
import { Button } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';
import { MessageScreen } from '@/shared/ui/MessageScreen';
import { colors, fonts, space } from '@/shared/ui/theme';
import { roleLabel, setScores, type SideId, sideName, toMatchSetup } from '@/sports/tennis';

import { MatchControls } from './MatchControls';
import { MatchEndScreen } from './MatchEndScreen';
import { MatchInfo } from './MatchInfo';
import { StatusPill } from './StatusPill';
import { MatchClock } from '../logic/MatchClock';

export function MatchScreen({ session }: { session: MatchSession }) {
  const { view, dispatch, log } = session;
  const { state } = view;
  // Read once: the camera and the buffer keep their settings for the whole match
  const [settings] = useState(() => appSettings.store.get());
  const [a, b] = state.config.sides;
  const setup = useMemo(() => toMatchSetup(session.form), [session.form]);

  useKeepAwake(); // otherwise the screen locks and the OS stops the camera
  // Dev builds only: the replay's ball tracking, live on the camera, to tune it on a court
  const [liveBallOn, setLiveBallOn] = useState(false);
  // Dev builds only: what Vosk heard, under the status pill (players never see it)
  const [showHeard, setShowHeard] = useState(false);
  const liveBall = useLiveBallTrack(__DEV__ && liveBallOn, session.form.court);
  const camera = useMatchCamera(liveBall.onFrame);
  // This phone's court, placed on its camera image: another camera films another picture
  const court = useCourtCalibration();
  const { clear: clearCourt } = court;
  useEffect(() => clearCourt(), [camera.facing, clearCourt]);
  const appActive = useAppActive();
  const [showQr, setShowQr] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [voiceOn, setVoiceOn] = useState(settings.voice);
  const [showSettings, setShowSettings] = useState(false);
  // On this phone only: each phone films for itself, a pause is not an event of the match
  const [paused, setPaused] = useState(false);

  // Recording pauses during the replay, to spare the phone (heat, battery), in the background,
  // where the OS stops the camera, and while the players pause the match (and the voice with it)
  const matchOver = state.matchWonBy !== undefined;
  const cameraActive = !view.varOpen && appActive && !matchOver && !paused;
  const { stats, clips } = useClipRecorder(
    camera.videoOutput,
    camera.running && cameraActive,
    settings.savedPoints,
  );
  useClipsFromLog(log, setup, clips);
  const replay = useVarReplay(view, log, clips);

  // The voice listens while the camera films. Not during the replay: the players talking in front of it must not count a point
  const voice = useVoice({
    state,
    enabled: voiceOn && camera.running && cameraActive,
    onPoints: (winners) => dispatch({ type: 'point-called', winners, afterSeq: view.seq }),
  });

  const sets = useMemo(() => setScores(setup, view.points), [setup, view.points]);
  const vars = useMemo(() => varSummary(log), [log]);
  const [clock] = useState(() => new MatchClock());
  useEffect(() => clock.varChanged(view.varOpen), [clock, view.varOpen]);
  useEffect(() => clock.pausedChanged(paused), [clock, paused]);
  // Nothing outlives the match (GDPR): the videos go as soon as it is won, the end screen says so
  useEffect(() => {
    if (!matchOver) return;
    clock.finish();
    clips.discard();
  }, [matchOver, clock, clips]);
  const link = linkStatus(session);

  const leave = () =>
    Alert.alert('Quitter le match ?', 'Les vidéos seront supprimées de ce téléphone.', [
      { text: 'Continuer', style: 'cancel' },
      { text: 'Quitter', style: 'destructive', onPress: () => router.replace('/') },
    ]);

  if (matchOver && !view.varOpen) {
    return (
      <MatchEndScreen
        state={state}
        sets={sets}
        teams={session.form.teams}
        vars={vars}
        {...clock.summary()}
      />
    );
  }

  if (!camera.permission.granted) {
    return (
      <MessageScreen
        message="Lineo a besoin de la caméra pour filmer les points."
        {...(!camera.permission.canAsk && { hint: 'Autorisez-la dans Réglages › Lineo.' })}
      >
        {camera.permission.canAsk && <Button label="Autoriser" onPress={camera.permission.ask} />}
      </MessageScreen>
    );
  }
  if (camera.device == null) {
    return (
      <MessageScreen
        message={camera.facing === 'front' ? 'Aucune caméra avant.' : 'Aucune caméra arrière.'}
      >
        <Button label="Changer de caméra" variant="secondary" onPress={camera.flip} />
      </MessageScreen>
    );
  }

  const heard = heardLine(voice);
  const undo = () =>
    Alert.alert('Annuler le dernier point ?', 'Le score revient au point précédent.', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Annuler le point',
        style: 'destructive',
        onPress: () => dispatch({ type: 'point-undone' }),
      },
    ]);
  const controls: PointControls = {
    canAdd: view.pending === undefined && !matchOver,
    // Only the side that won the last point can take it back
    canRemove: (side: SideId) => view.pending === undefined && view.points.at(-1) === side,
    onAdd: (side) => dispatch({ type: 'point-proposed', winner: side }),
    onRemove: undo,
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.rail}>
          <IconButton icon="info" label="Infos du match" onPress={() => setInfoOpen(true)} />
          {session.role === 'host' && (
            <IconButton icon="qr" label="Inviter un téléphone" onPress={() => setShowQr(true)} />
          )}
          <IconButton
            icon="cameraSwitch"
            label={
              camera.facing === 'back' ? 'Passer à la caméra avant' : 'Passer à la caméra arrière'
            }
            onPress={camera.flip}
          />
          <IconButton
            icon={voiceOn ? 'mic' : 'micOff'}
            label={voiceOn ? 'Couper la voix' : 'Activer la voix'}
            onPress={() => setVoiceOn(!voiceOn)}
          />
          {__DEV__ && (
            <IconButton
              icon="bot"
              label={showHeard ? 'Masquer ce que la voix entend' : 'Voir ce que la voix entend'}
              selected={showHeard}
              onPress={() => setShowHeard(!showHeard)}
            />
          )}
        </View>

        <View style={styles.main}>
          <View style={styles.top}>
            {showHeard && heard !== null && (
              <Text style={styles.heard} numberOfLines={1}>
                {heard}
              </Text>
            )}
            <StatusPill recording={stats.recording} link={link} />
            {/* The match keeps the settings it started with: changes are for the next one */}
            <IconButton
              icon="settings"
              label="Paramètres"
              variant="plain"
              onPress={() => setShowSettings(true)}
            />
          </View>
          <View style={styles.board}>
            <ScoreDisplay
              state={state}
              sets={sets}
              teams={session.form.teams}
              controls={controls}
            />
          </View>
          <MatchControls
            view={view}
            opening={view.varOpen && !replay}
            dispatch={dispatch}
            onLeave={leave}
            paused={paused}
            onTogglePause={() => setPaused(!paused)}
          />
        </View>
      </SafeAreaView>

      <MatchInfo
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        camera={camera}
        device={camera.device}
        cameraActive={cameraActive}
        recording={stats.recording}
        link={link}
        voiceStatus={voice.status}
        voiceOn={voiceOn}
        onToggleVoice={() => setVoiceOn(!voiceOn)}
        stats={stats}
        targetFps={settings.fps}
        savedPoints={settings.savedPoints}
        court={{
          calibration: court.calibration,
          geometry: court.geometry,
          onValidate: court.set,
        }}
        {...(__DEV__ && {
          liveTracking: { on: liveBallOn, onToggle: () => setLiveBallOn(!liveBallOn) },
        })}
        previewOverlay={
          liveBall.onFrame && liveBall.frame ? (
            <BallTrackOverlay points={liveBall.trail} video={liveBall.frame} timeS={liveBall.t} />
          ) : undefined
        }
        dev={
          liveBall.onFrame && liveBall.frame ? (
            <BallHud
              points={liveBall.trail}
              timeS={liveBall.t}
              frame={liveBall.frame}
              frames={liveBall.frames}
              seen={liveBall.seen}
              extra={`${liveBall.ms.toFixed(0)} ms / image`}
            />
          ) : undefined
        }
      />

      {showSettings && (
        <View style={StyleSheet.absoluteFill}>
          <SettingsScreen duringMatch onClose={() => setShowSettings(false)} />
        </View>
      )}

      {showQr && (
        <InviteOverlay
          sessionId={session.sessionId}
          sessionKey={session.key}
          wifi={session.role === 'host' ? session.wifi : []}
          phrase={session.role === 'host' ? session.phrase : undefined}
          phones={session.role === 'host' ? session.guests + 1 : 1}
          link={link.state}
          onClose={() => setShowQr(false)}
        />
      )}

      {replay && (
        <ReplayScreen
          clips={replay.clips}
          initialIndex={replay.initialIndex}
          fps={camera.selectedFps ?? settings.fps}
          assistedReading={settings.assistedReading}
          replayStart={settings.replayStart}
          court={session.form.court}
          courtLines={court.geometry}
          sides={[
            { id: a.id, name: sideName(state, a.id), role: roleLabel(state, a.id) },
            { id: b.id, name: sideName(state, b.id), role: roleLabel(state, b.id) },
          ]}
          // The players decided: the outcome goes to the log, then every phone goes back to the score
          onOutcome={(outcome) => outcomeEvents(view, outcome).forEach(dispatch)}
          onClose={() => dispatch({ type: 'var-closed' })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  safe: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: space.l,
    paddingVertical: space.s,
    gap: space.l,
  },
  rail: { gap: 12, paddingTop: 56 },
  main: { flex: 1, paddingBottom: space.m },
  top: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: space.s },
  board: { flex: 1, justifyContent: 'center' },
  heard: { flex: 1, fontFamily: fonts.light, fontSize: 15, color: colors.textSoft },
});
