import { useState } from 'react';

import type { CourtGeometry } from '@/features/court';
import type { Court } from '@/sports/tennis';

import { ClipPlayer } from './ClipPlayer';
import { DecisionPanel, type Side } from './components/DecisionPanel';
import type { PointNav } from './components/PlayerTopBar';
import type { ReplayOutcome } from '../logic/outcome';
import type { ReplayClip } from '../logic/toReplayClips';
import { loadDevVideos } from '../native/loadDevVideos';

type Props = {
  clips: readonly ReplayClip[];
  initialIndex: number;
  fps: number;
  /** The setting: the assisted reading card once the point is tracked */
  assistedReading: boolean;
  replayStart: 'start' | 'end';
  court: Court;
  /** This phone's court calibration, if any: for the match's points, not the test videos */
  courtLines: CourtGeometry | undefined;
  sides: readonly [Side, Side];
  onOutcome: (outcome: ReplayOutcome) => void;
  onClose: () => void;
};

/** Shown when `npm run dev:videos` has not been run on this phone */
const NO_DEV_VIDEOS: ReplayClip = {
  key: 'dev-none',
  title: 'Aucune vidéo test',
  subtitle: 'npm run dev:videos',
  segments: [],
};

export function ReplayScreen({
  clips,
  initialIndex,
  fps,
  assistedReading,
  replayStart,
  court,
  courtLines,
  sides,
  onOutcome,
  onClose,
}: Props) {
  const [index, setIndex] = useState(initialIndex);
  // Dev builds only: test videos instead of the match's points
  const [devClips, setDevClips] = useState<ReplayClip[]>();

  const shown = devClips ?? clips;
  const clip = shown[index];
  if (!clip) return null;

  const toggleDevVideos = () => {
    if (devClips) {
      setDevClips(undefined);
      setIndex(initialIndex);
      return;
    }
    void loadDevVideos().then((videos) => {
      setDevClips(videos.length > 0 ? videos : [NO_DEV_VIDEOS]);
      setIndex(0);
    });
  };

  const point: PointNav = {
    section: `${clip.subtitle} · ${index + 1}/${shown.length}`,
    title: clip.title,
    onPrevious: index > 0 ? () => setIndex(index - 1) : undefined,
    onNext: index < shown.length - 1 ? () => setIndex(index + 1) : undefined,
  };
  return (
    <ClipPlayer
      key={clip.key}
      segments={clip.segments}
      fps={clip.fps ?? fps}
      court={court}
      courtLines={devClips ? undefined : courtLines}
      assistedReading={assistedReading}
      replayStart={replayStart}
      point={point}
      renderPanel={
        // A test video is not a point of the match: nothing to decide
        devClips
          ? undefined
          : (close) => <DecisionPanel sides={sides} onOutcome={onOutcome} onClose={close} />
      }
      devVideos={__DEV__ ? { on: devClips !== undefined, onToggle: toggleDevVideos } : undefined}
      onClose={onClose}
    />
  );
}
