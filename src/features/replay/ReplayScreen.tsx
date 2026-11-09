import { type ReactNode, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Video, { type VideoRef } from 'react-native-video';

import { toUri } from '@/adapters/files';
import type { Segment } from '@/core/clips/Segment';
import { buildTimeline, locate } from '@/core/clips/timeline';
import type { ReplayOutcome } from '@/core/events/outcome';
import type { SideId } from '@/core/score/types';
import { colors, radius, touch } from '@/ui/theme';
import { ZoomableView } from '@/ui/ZoomableView';

import { useSoundPeaks } from './useSoundPeaks';

const RATES = [0.25, 0.5, 1] as const;
const DEFAULT_RATE = 0.5;
/** Where a point opens, in seconds before its end (the end is what players argue about). */
const START_BEFORE_END_SECONDS = 1;
/** A jump to a sound peak lands this long before it, to see the ball come in frame by frame. */
const PEAK_LEAD_SECONDS = 0.15;

export type ReplayClip = {
  key: string;
  /** E.g. "Set 1 · Jeu 4 · 30-15". */
  title: string;
  /** E.g. "Dernier point", "Point en cours". */
  subtitle: string;
  segments: readonly Segment[];
};

type Side = { id: SideId; name: string };

type Props = {
  /** Oldest first: "◀" goes back in time. */
  clips: readonly ReplayClip[];
  initialIndex: number;
  /** Camera frame rate, used to step exactly one frame. */
  fps: number;
  sides: readonly [Side, Side];
  onOutcome: (outcome: ReplayOutcome) => void;
  /** Back to the score without changing anything. */
  onClose: () => void;
};

/** VAR: one point at a time, with "◀ / ▶" to move between the 3 points kept on the phone. */
export function ReplayScreen({ clips, initialIndex, fps, sides, onOutcome, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const clip = clips[index];
  if (!clip) return null;

  const header = (
    <View style={styles.nav}>
      <NavButton label="◀" disabled={index === 0} onPress={() => setIndex(index - 1)} />
      <View style={styles.navText}>
        <Text style={styles.navSubtitle}>
          {clip.subtitle} · {index + 1}/{clips.length}
        </Text>
        <Text style={styles.navTitle} numberOfLines={2}>
          {clip.title}
        </Text>
      </View>
      <NavButton
        label="▶"
        disabled={index === clips.length - 1}
        onPress={() => setIndex(index + 1)}
      />
    </View>
  );

  return (
    <ClipPlayer
      key={clip.key}
      segments={clip.segments}
      fps={fps}
      header={header}
      footer={<OutcomeBar sides={sides} onOutcome={onOutcome} />}
      onClose={onClose}
    />
  );
}

/**
 * The three outcomes, always visible. Choosing one asks the other side to confirm on the same
 * screen: the result only counts once both sides agree.
 */
function OutcomeBar({
  sides,
  onOutcome,
}: {
  sides: readonly [Side, Side];
  onOutcome: (outcome: ReplayOutcome) => void;
}) {
  const [chosen, setChosen] = useState<ReplayOutcome>();

  if (chosen) {
    const label =
      chosen.kind === 'replayed'
        ? 'Point rejoué'
        : `Point ${sides.find((s) => s.id === chosen.winner)?.name ?? ''}`;
    return (
      <View style={styles.confirm}>
        <Text style={styles.confirmText}>{label} : l’autre camp est d’accord ?</Text>
        <View style={styles.outcomes}>
          <BarButton label="Valider" primary onPress={() => onOutcome(chosen)} />
          <BarButton label="Changer" onPress={() => setChosen(undefined)} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.outcomes}>
      {sides.map((side) => (
        <BarButton
          key={side.id}
          label={`Point ${side.name}`}
          onPress={() => setChosen({ kind: 'point', winner: side.id })}
        />
      ))}
      <BarButton label="Point rejoué" onPress={() => setChosen({ kind: 'replayed' })} />
    </View>
  );
}

type PlayerProps = {
  segments: readonly Segment[];
  fps: number;
  header: ReactNode;
  footer: ReactNode;
  onClose: () => void;
};

/**
 * Plays one point: one file almost always. When a point has several files they are stacked, all
 * loaded, and only the active one is visible, so switching files needs no reload.
 */
function ClipPlayer({ segments, fps, header, footer, onClose }: PlayerProps) {
  const timeline = useMemo(() => buildTimeline(segments), [segments]);
  const initial = useMemo(() => {
    const t = Math.max(0, timeline.totalS - START_BEFORE_END_SECONDS);
    return { t, ...locate(timeline, t) };
  }, [timeline]);

  const videoRefs = useRef<(VideoRef | null)[]>([]);
  const timeRef = useRef(initial.t);
  const initialSeekDone = useRef(false);
  const [activeIndex, setActiveIndex] = useState(initial.index);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState<number>(DEFAULT_RATE);
  const [timeS, setTimeS] = useState(initial.t);
  const [barWidth, setBarWidth] = useState(1);
  const peaks = useSoundPeaks(timeline);

  const setTime = (t: number) => {
    timeRef.current = t;
    setTimeS(t);
  };

  const seekTo = (t: number) => {
    const target = locate(timeline, t, activeIndex);
    // Zero tolerance: the player lands on the exact frame instead of the nearest keyframe.
    videoRefs.current[target.index]?.seek(target.localS, 0);
    setActiveIndex(target.index);
    setTime((timeline.segments[target.index]?.offsetS ?? 0) + target.localS);
  };

  const stepFrame = (direction: 1 | -1) => {
    setPlaying(false);
    seekTo(timeRef.current + direction / fps);
  };

  /** Pauses just before the next (or previous) loud sound: a hit, a bounce, or anything else. */
  const jumpToPeak = (direction: 1 | -1) => {
    const targets = peaks.map((t) => Math.max(0, t - PEAK_LEAD_SECONDS));
    const now = timeRef.current;
    const target =
      direction === 1
        ? targets.find((t) => t > now + 0.01)
        : targets.findLast((t) => t < now - 0.01);
    if (target === undefined) return;
    setPlaying(false);
    seekTo(target);
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

  if (timeline.segments.length === 0) {
    return (
      <SafeAreaView style={styles.empty}>
        <View style={styles.emptyHeader}>{header}</View>
        <Text style={styles.emptyText}>Pas de vidéo pour ce point.</Text>
        <Pressable style={styles.close} onPress={onClose}>
          <Text style={styles.closeText}>← Retour au score</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const progress = timeline.totalS > 0 ? timeS / timeline.totalS : 0;

  return (
    <View style={styles.container}>
      <View style={styles.stage}>
        <ZoomableView>
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
              // the phone on silent, which it usually is on court.
              muted={rate !== 1 || index !== activeIndex}
              ignoreSilentSwitch="ignore"
              repeat={false}
              progressUpdateInterval={33}
              onLoad={() => {
                if (index !== initial.index) return;
                // Already on the right frame: no seek, so no onSeek event to wait for.
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
        </ZoomableView>

        <SafeAreaView style={styles.topBar} edges={['top', 'left']} pointerEvents="box-none">
          <Pressable style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>← Retour au score</Text>
          </Pressable>
          <View style={styles.badge}>{header}</View>
        </SafeAreaView>
      </View>

      <SafeAreaView style={styles.panel} edges={['top', 'bottom', 'right']}>
        <ScrollView contentContainerStyle={styles.panelContent}>
          <Text style={styles.time}>
            {(timeS - timeline.totalS).toFixed(2)} s · x{rate}
          </Text>
          <Pressable
            style={styles.track}
            onLayout={(e) => setBarWidth(Math.max(1, e.nativeEvent.layout.width))}
            onPress={(e) => {
              setPlaying(false);
              seekTo((e.nativeEvent.locationX / barWidth) * timeline.totalS);
            }}
          >
            <View style={[styles.trackFill, { width: `${Math.min(100, progress * 100)}%` }]} />
            {peaks.map((t) => (
              <View
                key={t}
                pointerEvents="none"
                style={[styles.peak, { left: `${(t / timeline.totalS) * 100}%` }]}
              />
            ))}
          </Pressable>
          {peaks.length > 0 && (
            <View style={styles.row}>
              <ControlButton label="◀ Son" onPress={() => jumpToPeak(-1)} />
              <ControlButton label="Son ▶" onPress={() => jumpToPeak(1)} />
            </View>
          )}

          <View style={styles.row}>
            <ControlButton label="◀◀" onPress={() => stepFrame(-1)} />
            <ControlButton label={playing ? '❚❚' : '▶'} onPress={togglePlay} />
            <ControlButton label="▶▶" onPress={() => stepFrame(1)} />
          </View>
          <View style={styles.row}>
            {RATES.map((r) => (
              <ControlButton
                key={r}
                label={`x${r}`}
                selected={rate === r}
                onPress={() => setRate(r)}
              />
            ))}
          </View>
          {footer}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function NavButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.navButton,
        pressed && styles.buttonOn,
        disabled && styles.dim,
      ]}
    >
      <Text style={styles.navButtonText}>{label}</Text>
    </Pressable>
  );
}

function ControlButton({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, (selected || pressed) && styles.buttonOn]}
    >
      {({ pressed }) => (
        <Text style={[styles.buttonText, (selected || pressed) && styles.buttonTextOn]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function BarButton({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.outcome,
        primary && styles.outcomePrimary,
        pressed && styles.dim,
      ]}
    >
      <Text style={styles.outcomeText} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
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
  topBar: { position: 'absolute', top: 0, left: 0, maxWidth: 420, padding: 16, gap: 12 },
  badge: { backgroundColor: 'rgba(17,17,17,0.75)', padding: 12, borderRadius: radius },
  close: {
    alignSelf: 'flex-start',
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: radius,
    paddingHorizontal: 18,
    minHeight: touch,
    justifyContent: 'center',
    backgroundColor: 'rgba(17,17,17,0.75)',
  },
  closeText: { color: colors.line, fontSize: 18, fontWeight: '700' },
  panel: { width: 300, backgroundColor: colors.ink },
  panelContent: { padding: 16, gap: 12 },
  time: {
    color: colors.line,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 32,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  trackFill: { height: '100%', backgroundColor: colors.ball },
  /** A sound peak: a mark, not a verdict. */
  peak: { position: 'absolute', top: 6, bottom: 6, width: 2, backgroundColor: colors.line },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  outcomes: { gap: 8 },
  button: {
    flex: 1,
    minHeight: touch,
    paddingHorizontal: 14,
    borderRadius: radius,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonOn: { backgroundColor: colors.line },
  buttonText: { color: colors.line, fontSize: 18, fontWeight: '700' },
  buttonTextOn: { color: colors.ink },
  outcome: {
    minHeight: touch,
    borderRadius: radius,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  outcomePrimary: { backgroundColor: colors.court, borderColor: colors.court },
  outcomeText: { color: colors.line, fontSize: 18, fontWeight: '700' },
  confirm: { gap: 12 },
  confirmText: { color: colors.line, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  empty: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  emptyText: { color: colors.line, fontSize: 22 },
  emptyHeader: {
    alignSelf: 'stretch',
    marginHorizontal: 16,
    backgroundColor: colors.inkSoft,
    borderRadius: radius,
    padding: 12,
  },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navText: { flexShrink: 1, flexGrow: 1 },
  navSubtitle: { color: colors.ball, fontSize: 16, fontWeight: '800' },
  navTitle: { color: colors.line, fontSize: 18, fontWeight: '800' },
  navButton: {
    width: touch,
    height: touch,
    borderRadius: touch / 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonText: { color: colors.line, fontSize: 22, fontWeight: '900' },
  dim: { opacity: 0.3 },
});
