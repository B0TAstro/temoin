import { type ReactNode, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Video, { type VideoRef } from 'react-native-video';

import { BallHud, BallTrackOverlay, bounceMarks, useBallTrack } from '@/features/ball-tracking';
import { courtArea, type CourtGeometry, CourtLinesOverlay } from '@/features/court';
import { buildTimeline, locate, type Segment } from '@/features/recording';
import { stopBeforePeak, useSoundPeaks } from '@/features/sound-peaks';
import { toUri } from '@/shared/native/files';
import { Fade } from '@/shared/ui/Fade';
import { colors, fonts } from '@/shared/ui/theme';
import { ZoomableView } from '@/shared/ui/ZoomableView';
import type { Court } from '@/sports/tennis';

import { useAutoHide } from '../useAutoHide';
import { AssistedReading } from './components/AssistedReading';
import { PlayerControls } from './components/PlayerControls';
import { PlayerTools, nextRate, type Rate } from './components/PlayerTools';
import { type PointNav, PlayerTopBar } from './components/PlayerTopBar';
import { Seekbar } from './components/Seekbar';

/** Opened on the end of the point: this long before it (the end is what players argue about) */
const START_BEFORE_END_SECONDS = 1;
/** A jump to a sound peak lands this long before it */
const PEAK_LEAD_SECONDS = 0.15;

/**
 * Plays one point: one file almost always. When a point has several files they are stacked, all loaded, and only the active one is visible, so switching files needs no reload
 */
export function ClipPlayer({
  segments,
  fps,
  court,
  courtLines,
  assistedReading,
  replayStart,
  point,
  renderPanel,
  devVideos,
  onClose,
}: {
  segments: readonly Segment[];
  fps: number;
  /** The court of the session: the ball tracking takes its settings from it */
  court: Court;
  /**
   * The court as this phone calibrated it, if it did: its lines over the video, and the area the
   * ball is looked for in
   */
  courtLines: CourtGeometry | undefined;
  /** The setting: shows the assisted reading card once the point is tracked */
  assistedReading: boolean;
  /** From the settings: the start of the point, or its last second */
  replayStart: 'start' | 'end';
  point: PointNav;
  /** The decision panel beside the video, with its button to close it; none for a test video */
  renderPanel: ((close: () => void) => ReactNode) | undefined;
  /** Dev builds only: the switch to the test videos, next to the panel button */
  devVideos: { on: boolean; onToggle: () => void } | undefined;
  onClose: () => void;
}) {
  const timeline = useMemo(() => buildTimeline(segments), [segments]);
  const initial = useMemo(() => {
    const t = replayStart === 'end' ? Math.max(0, timeline.totalS - START_BEFORE_END_SECONDS) : 0;
    return { t, ...locate(timeline, t) };
  }, [timeline, replayStart]);

  const videoRefs = useRef<(VideoRef | null)[]>([]);
  const timeRef = useRef(initial.t);
  const initialSeekDone = useRef(false);
  const [activeIndex, setActiveIndex] = useState(initial.index);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState<Rate>(1);
  const [muted, setMuted] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const insets = useSafeAreaInsets();
  const [timeS, setTimeS] = useState(initial.t);
  const peaks = useSoundPeaks(timeline);
  const [inPlay] = useState(() => (courtLines ? courtArea(courtLines) : undefined));
  const ball = useBallTrack(timeline, timeS, court, inPlay);
  const [linesOn, setLinesOn] = useState(true);
  const bounces = useMemo(() => bounceMarks(ball.points, peaks), [ball.points, peaks]);
  const [readingOpen, setReadingOpen] = useState(true);

  const setTime = (t: number) => {
    timeRef.current = t;
    setTimeS(t);
  };

  const seekTo = (t: number) => {
    const target = locate(timeline, t, activeIndex);
    videoRefs.current[target.index]?.seek(target.localS, 0);
    setActiveIndex(target.index);
    setTime((timeline.segments[target.index]?.offsetS ?? 0) + target.localS);
  };

  const pauseAt = (t: number) => {
    setPlaying(false);
    seekTo(t);
  };

  const stepFrame = (direction: 1 | -1) => pauseAt(timeRef.current + direction / fps);

  /** Pauses just before the next (or previous) loud sound: a hit, a bounce, or anything else */
  const jumpToPeak = (direction: 1 | -1) => {
    const target = stopBeforePeak(peaks, timeRef.current, direction, PEAK_LEAD_SECONDS);
    if (target !== undefined) pauseAt(target);
  };

  const togglePlay = () => {
    if (!playing && timeRef.current >= timeline.totalS - 1 / fps) seekTo(0);
    setPlaying((p) => !p);
  };

  const onSegmentEnd = (index: number) => {
    if (index !== activeIndex) return;
    const segment = timeline.segments[index];
    const next = timeline.segments[index + 1];
    if (!segment || !next) {
      setPlaying(false);
      setTime(timeline.totalS);
      return;
    }
    const t = segment.offsetS + segment.durationS;
    videoRefs.current[index + 1]?.seek(Math.max(0, t - next.offsetS), 0);
    setActiveIndex(index + 1);
    setTime(t);
  };

  const onInitialSeekDone = () => {
    if (initialSeekDone.current) return;
    initialSeekDone.current = true;
    setPlaying(true);
  };

  const chrome = useAutoHide();
  // Any tap on a control counts as activity: the controls stay a few more seconds
  const onTogglePlay = () => {
    chrome.show();
    togglePlay();
  };
  const onStepFrame = (direction: 1 | -1) => {
    chrome.show();
    stepFrame(direction);
  };
  const onJumpToPeak = (direction: 1 | -1) => {
    chrome.show();
    jumpToPeak(direction);
  };
  const onScrub = (t: number) => {
    chrome.show();
    pauseAt(t);
  };
  const tool = (action: () => void) => () => {
    chrome.show();
    action();
  };
  const chromeStyle = useAnimatedStyle(
    () => ({ opacity: withTiming(chrome.visible ? 1 : 0, { duration: 200 }) }),
    [chrome.visible],
  );

  const panelShown = panelOpen && renderPanel !== undefined;
  const topBar = (
    <PlayerTopBar
      point={point}
      onBack={onClose}
      devVideos={devVideos}
      onOpenPanel={renderPanel && !panelShown ? tool(() => setPanelOpen(true)) : undefined}
    />
  );
  const panel = panelShown ? (
    <SafeAreaView style={styles.panel} edges={['top', 'bottom', 'right']}>
      {renderPanel(() => setPanelOpen(false))}
    </SafeAreaView>
  ) : null;

  if (timeline.segments.length === 0) {
    return (
      <View style={styles.container}>
        <View
          style={[styles.stage, { paddingTop: insets.top + 16, paddingLeft: insets.left + 24 }]}
        >
          <View style={styles.emptyTop}>{topBar}</View>
          <Text style={styles.emptyText}>Pas de vidéo pour ce point.</Text>
        </View>
        {panel}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.stage}>
        <ZoomableView onTap={chrome.toggle}>
          {timeline.segments.map((segment, index) => (
            <Video
              key={segment.path}
              ref={(ref) => {
                videoRefs.current[index] = ref;
              }}
              source={{ uri: toUri(segment.path) }}
              style={[StyleSheet.absoluteFill, index !== activeIndex && styles.hidden]}
              resizeMode="contain"
              paused={!playing || index !== activeIndex}
              rate={rate}
              // Sound at normal speed only: stretched to slow motion it is no help. Played even with
              // the phone on silent, which it usually is on court
              muted={muted || rate !== 1 || index !== activeIndex}
              ignoreSilentSwitch="ignore"
              repeat={false}
              progressUpdateInterval={33}
              onLoad={(e) => {
                if (index !== initial.index) return;
                // Already on the right frame: no seek, so no onSeek event to wait for
                if (initial.localS < 1 / fps) onInitialSeekDone();
                else videoRefs.current[index]?.seek(initial.localS, 0);
              }}
              onSeek={() => {
                if (index === initial.index) onInitialSeekDone();
              }}
              onProgress={(e) => {
                if (index === activeIndex && playing) setTime(segment.offsetS + e.currentTime);
              }}
              onEnd={() => onSegmentEnd(index)}
            />
          ))}
          {courtLines && linesOn && <CourtLinesOverlay geometry={courtLines} mode="contain" />}
          {ball.on && ball.video && (
            <BallTrackOverlay
              points={ball.points}
              bounces={bounces}
              video={ball.video}
              timeS={timeS}
            />
          )}
        </ZoomableView>

        {/* Dev builds only: the tracking's figures, to tune it on a court */}
        {__DEV__ && ball.on && ball.frame && (
          <View style={[styles.hud, { bottom: insets.bottom + 72 }]} pointerEvents="none">
            <BallHud
              points={ball.points}
              timeS={timeS}
              frame={ball.frame}
              frames={ball.frames}
              seen={ball.seen}
              extra={`${ball.ms.toFixed(0)} ms / image   trajectoire ${ball.trackMs.toFixed(0)} ms`}
            />
          </View>
        )}

        {/* The controls, over the video like any player: they fade out after a few idle seconds */}
        <Animated.View
          style={[StyleSheet.absoluteFill, chromeStyle]}
          pointerEvents={chrome.visible ? 'box-none' : 'none'}
        >
          <Fade from={0.85} to={0} style={styles.fadeTop} />
          <Fade from={0} to={0.9} style={styles.fadeBottom} />
          <View
            style={[
              styles.top,
              {
                top: insets.top + 16,
                left: insets.left + 24,
                right: (panelShown ? 0 : insets.right) + 24,
              },
            ]}
            pointerEvents="box-none"
          >
            {topBar}
          </View>
          <View style={styles.center} pointerEvents="box-none">
            <PlayerControls
              playing={playing}
              hasPeaks={peaks.length > 0}
              onTogglePlay={onTogglePlay}
              onStepFrame={onStepFrame}
              onJumpToPeak={onJumpToPeak}
            />
          </View>
          <View
            style={[
              styles.bottom,
              {
                bottom: insets.bottom + 16,
                left: insets.left + 24,
                right: (panelShown ? 0 : insets.right) + 24,
              },
            ]}
            pointerEvents="box-none"
          >
            <Text style={styles.time}>
              {clock(timeS)} / {clock(timeline.totalS)}
            </Text>
            <View style={styles.bottomRow}>
              <Seekbar timeS={timeS} totalS={timeline.totalS} peaks={peaks} onSeek={onScrub} />
              <PlayerTools
                tracking={ball.on}
                onTrack={tool(() => {
                  setReadingOpen(true);
                  ball.toggle();
                })}
                muted={muted}
                onToggleMute={tool(() => setMuted(!muted))}
                rate={rate}
                onNextRate={tool(() => setRate(nextRate(rate)))}
                lines={courtLines ? linesOn : undefined}
                onToggleLines={tool(() => setLinesOn(!linesOn))}
              />
            </View>
          </View>
        </Animated.View>

        {/* Once the whole point is tracked: stays over the video, the controls fade without it */}
        {assistedReading && ball.on && ball.done && (
          <View
            style={[styles.reading, { top: insets.top + 72, left: insets.left + 24 }]}
            pointerEvents="box-none"
          >
            <AssistedReading
              open={readingOpen}
              onOpen={() => setReadingOpen(true)}
              onClose={() => setReadingOpen(false)}
            />
          </View>
        )}
      </View>

      {panel}
    </View>
  );
}

/** 0:02 */
function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: '#000',
  },
  stage: { flex: 1 },
  hidden: { opacity: 0 },
  hud: { position: 'absolute', left: 0, paddingLeft: 24 },
  reading: { position: 'absolute' },
  fadeTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 96 },
  fadeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 110 },
  top: { position: 'absolute' },
  center: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: { position: 'absolute', gap: 8 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  time: { fontFamily: fonts.light, fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  panel: { width: 220, backgroundColor: colors.card },
  emptyTop: { paddingRight: 24 },
  emptyText: {
    fontFamily: fonts.light,
    fontSize: 20,
    color: colors.text,
    textAlign: 'center',
    marginTop: 96,
  },
});
