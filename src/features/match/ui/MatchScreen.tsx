import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TARGET_FPS, useClipRecorder, useClipsFromLog, useMatchCamera } from '@/features/recording';
import { outcomeEvents, ReplayScreen, useVarReplay } from '@/features/replay';
import { ScoreDisplay } from '@/features/score';
import { InviteOverlay, linkLabel, type MatchSession } from '@/features/session';
import { heardLine, useVoice } from '@/features/voice';
import { useAppActive } from '@/shared/native/useAppActive';
import { Button } from '@/shared/ui/Button';
import { MessageScreen } from '@/shared/ui/MessageScreen';
import { colors } from '@/shared/ui/theme';
import { sideName, toMatchSetup } from '@/sports/tennis';

import { DevStats } from './DevStats';
import { MatchControls } from './MatchControls';
import { MatchSidebar } from './MatchSidebar';

export function MatchScreen({ session }: { session: MatchSession }) {
  const { view, dispatch, log } = session;
  const { state } = view;
  const [a, b] = state.config.sides;
  const setup = useMemo(() => toMatchSetup(session.form), [session.form]);

  useKeepAwake(); // otherwise the screen locks and the OS stops the camera
  const camera = useMatchCamera();
  const appActive = useAppActive();
  const [showQr, setShowQr] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);

  // Recording pauses during the replay, to spare the phone (heat, battery), and in the background, where the OS stops the camera
  const matchOver = state.matchWonBy !== undefined;
  const cameraActive = !view.varOpen && appActive && !matchOver;
  const { stats, clips } = useClipRecorder(camera.videoOutput, camera.running && cameraActive);
  useClipsFromLog(log, setup, clips);
  const replay = useVarReplay(view, log, clips);

  // The voice listens while the camera films. Not during the replay: the players talking in front of it must not count a point
  const voice = useVoice({
    state,
    enabled: voiceOn && camera.running && cameraActive,
    onPoints: (winners) => dispatch({ type: 'point-called', winners, afterSeq: view.seq }),
  });

  const leave = () =>
    Alert.alert('Quitter le match ?', 'Les vidéos seront supprimées de ce téléphone.', [
      { text: 'Continuer', style: 'cancel' },
      { text: 'Quitter', style: 'destructive', onPress: () => router.replace('/') },
    ]);

  if (!camera.permission.granted) {
    return (
      <MessageScreen
        message="Témoin a besoin de la caméra pour filmer les points."
        {...(!camera.permission.canAsk && { hint: 'Autorisez-la dans Réglages › Témoin.' })}
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
        <Button label="Changer de caméra" variant="outline" onPress={camera.flip} />
      </MessageScreen>
    );
  }

  const heard = heardLine(voice);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.side}>
          <MatchSidebar
            camera={camera}
            device={camera.device}
            cameraActive={cameraActive}
            recording={stats.recording}
            matchOver={matchOver}
            linkText={linkLabel(session)}
            voiceStatus={voice.status}
            voiceOn={voiceOn}
            onToggleVoice={() => setVoiceOn(!voiceOn)}
            onInvite={session.role === 'host' ? () => setShowQr(true) : undefined}
            onLeave={leave}
          />
        </View>

        <View style={styles.middle}>
          <View style={styles.board}>
            <ScoreDisplay state={state} />
            {heard !== null && (
              <Text style={styles.heard} numberOfLines={1}>
                {heard}
              </Text>
            )}
          </View>
          {__DEV__ && (
            <DevStats
              fps={camera.fps}
              selectedFps={camera.selectedFps}
              stats={stats}
              sessionId={session.sessionId}
              eventCount={log.length}
              voiceError={voice.error}
            />
          )}
        </View>

        <View style={styles.side}>
          <MatchControls view={view} opening={view.varOpen && !replay} dispatch={dispatch} />
        </View>
      </SafeAreaView>

      {showQr && (
        <InviteOverlay
          sessionId={session.sessionId}
          sessionKey={session.key}
          onClose={() => setShowQr(false)}
        />
      )}

      {replay && (
        <ReplayScreen
          clips={replay.clips}
          initialIndex={replay.initialIndex}
          fps={camera.selectedFps ?? TARGET_FPS}
          sides={[
            { id: a.id, name: sideName(state, a.id) },
            { id: b.id, name: sideName(state, b.id) },
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
  container: { flex: 1, backgroundColor: colors.ink },
  safe: { flex: 1, flexDirection: 'row', padding: 12, gap: 16 },
  side: { width: 220, gap: 10, justifyContent: 'center' },
  middle: { flex: 1 },
  board: { flex: 1, justifyContent: 'center', gap: 12 },
  heard: { color: colors.lineDim, fontSize: 18, textAlign: 'center' },
});
