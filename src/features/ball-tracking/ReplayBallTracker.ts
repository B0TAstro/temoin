import { locate, type Timeline } from '@/features/recording';
import { Store } from '@/shared/lib/Store';

import type { FrameCandidates } from './logic/arc';
import { type BallConfig } from './logic/ballConfig';
import { type BallPoint, toBallPoint } from './logic/ballPoint';
import { trackClip } from './logic/trackClip';
import type { ClipFrames, FrameSize } from './native/ClipFrames';
import type { BallDetector } from './native/OpenCvDetector';

/** Reading starts this long before the time on screen: the ball's path needs what came before. */
const BEFORE_S = 1.5;
/** And goes on this long after it: the path needs what comes after too, and playing on finds it ready. */
const AHEAD_S = 1.5;
/** Further behind the time on screen than this, the reader jumps instead of catching up. */
const MAX_LAG_S = 0.5;
/** After such a jump, reading starts this long before the time on screen. */
const CATCH_UP_S = 0.2;
/** Half a frame at 120 fps: a frame this close to the time asked for is that frame. */
const SAME_FRAME_S = 0.004;
/**
 * The path is worked out again every so many frames read, and once reading has caught up. Each
 * time is on all the frames kept: not too often, it runs on the JS thread.
 */
const TRACK_EVERY = 30;
/** Frames older than this before the last one read are dropped: a long point played through. */
const KEEP_S = 8;

export type BallTrackState = {
  on: boolean;
  /** The ball's path through the frames read, oldest first: drawn up to the time on screen. */
  points: BallPoint[];
  /** Frames read around the time on screen, and how many of them show the ball. */
  frames: number;
  seen: number;
  /** Time OpenCV took on the last frame, in ms. */
  ms: number;
  /** Time the last working out of the path took, in ms. */
  trackMs: number;
  /** Size of the video as played, for the drawing. */
  video: { width: number; height: number } | undefined;
  /** Size of the analysed frames, for the figures in pixels. */
  frame: { width: number; height: number } | undefined;
  error: string | undefined;
  /** The reading reached the end of the point's last file: the whole point has been analysed */
  done: boolean;
};

const OFF: BallTrackState = {
  on: false,
  points: [],
  frames: 0,
  seen: 0,
  ms: 0,
  trackMs: 0,
  video: undefined,
  frame: undefined,
  error: undefined,
  done: false,
};

/** What has been read of one file: a run of frames in a row, and what the detector found in each. */
type Reading = {
  index: number;
  size: FrameSize;
  /** Where reading started, in the file: nothing is known before it. */
  startS: number;
  /** The time on screen it was started for: until reading gets there, it is not "behind". */
  aimS: number;
  /** Time of the last frame read; before the first, just before `startS`. */
  readS: number;
  ended: boolean;
  frames: FrameCandidates[];
  /** Frames read since the path was last worked out. */
  untracked: number;
};

/**
 * The ball tracked on the replay. While it is on, the frames around the time on screen are read
 * (native reader) and searched (OpenCV), from a little before it to a little after, and the ball's
 * path is worked out on all of them at once (`logic/trackClip`): a replay is a file, what comes
 * after a frame is known as well as what came before.
 *
 * What has been read is kept: stepping back, pausing, playing again inside it costs nothing and
 * the path does not change. Reading only goes forward, so going back before it, or jumping far
 * ahead, starts a new reading. Nothing runs while it is off, nor while the match is filmed.
 */
export class ReplayBallTracker {
  readonly store = new Store<BallTrackState>(OFF);
  private generation = 0;
  private target = 0;
  /** The generation the running pump works for: at most one pump per generation. */
  private pumping = -1;
  private reading: Reading | undefined;

  constructor(
    private readonly timeline: Timeline,
    private readonly frames: ClipFrames,
    private readonly detector: BallDetector,
    private readonly config: BallConfig,
    /**
     * Where the ball can be, in fractions of the picture: the court and a margin around it, once
     * the phone is calibrated. Blobs elsewhere (stands, spectators at the sides) are left out
     */
    private readonly inPlay: ((point: { x: number; y: number }) => boolean) | undefined,
  ) {}

  setOn(on: boolean) {
    this.stop();
    if (on) this.store.set({ ...OFF, on: true });
  }

  /** The time on screen, on the replay timeline: reading keeps a little ahead of it. */
  follow(timeS: number) {
    if (!this.store.get().on) return;
    this.target = timeS;
    if (this.pumping !== this.generation) void this.pump(this.generation);
  }

  /** Turns it off and lets the reader go (another point, the replay closed). */
  stop() {
    this.generation++;
    this.reading = undefined;
    this.detector.reset();
    this.frames.close();
    this.store.set(OFF);
  }

  private async pump(generation: number) {
    this.pumping = generation;
    try {
      for (;;) {
        if (generation !== this.generation) return;
        const { index, localS } = locate(this.timeline, this.target);
        const segment = this.timeline.segments[index];
        if (!segment) return;
        const reading = this.reading;

        // Another file, or back before what was read: from well before the time on screen
        if (!reading || reading.index !== index || localS < reading.startS - SAME_FRAME_S) {
          await this.open(index, Math.max(0, localS - BEFORE_S), localS);
          continue;
        }
        // Too far behind (a jump ahead, or playback faster than the analysis): from just before it
        if (localS - Math.max(reading.readS, reading.aimS) > MAX_LAG_S) {
          await this.open(index, Math.max(0, localS - CATCH_UP_S), localS);
          continue;
        }
        if (reading.ended || reading.readS >= localS + AHEAD_S - SAME_FRAME_S) {
          if (reading.untracked > 0) this.track(reading);
          const last = reading.index === this.timeline.segments.length - 1;
          if (reading.ended && last && !this.store.get().done) this.store.set({ done: true });
          return;
        }

        const pixels = await this.frames.next();
        if (generation !== this.generation) return;
        if (pixels.byteLength === 0) {
          reading.ended = true;
          continue;
        }
        reading.readS = this.frames.time();
        this.search(reading, pixels);
        if (reading.untracked >= TRACK_EVERY) this.track(reading);
      }
    } catch (reason) {
      if (generation === this.generation) this.store.set({ error: String(reason) });
    } finally {
      if (this.pumping === generation) this.pumping = -1;
    }
  }

  private async open(index: number, startS: number, aimS: number) {
    const generation = this.generation;
    const segment = this.timeline.segments[index];
    if (!segment) return;
    const size = await this.frames.open(
      segment.path,
      startS,
      segment.durationS,
      this.config.maxSide,
    );
    if (generation !== this.generation) return;
    // The detector compares each frame with its neighbours: a jump in time starts it over
    this.detector.reset();
    this.reading = {
      index,
      size,
      startS,
      aimS,
      readS: startS - SAME_FRAME_S,
      ended: false,
      frames: [],
      untracked: 0,
    };
    // The path already drawn stays until the new reading has one: no blink on a step back
    this.store.set({
      video: { width: size.videoWidth, height: size.videoHeight },
      frame: { width: size.width, height: size.height },
    });
  }

  /** One more frame for the detector: the frames it can now judge join what was read. */
  private search(reading: Reading, pixels: ArrayBuffer) {
    const start = performance.now();
    const { width, height } = reading.size;
    // It judges a frame against the ones after it: its answers are a frame or two behind, and
    // carry their own time. A repeated frame (screen recordings) gets no answer.
    const judged = this.detector.detect({ pixels, width, height, format: 'rgb' }, reading.readS);
    this.store.set({ ms: performance.now() - start });
    const inPlay = this.inPlay;
    reading.frames.push(
      ...(inPlay
        ? judged.map((frame) => ({
            ...frame,
            candidates: frame.candidates.filter((c) => inPlay({ x: c.x / width, y: c.y / height })),
          }))
        : judged),
    );
    reading.untracked += judged.length;

    const oldest = reading.readS - KEEP_S;
    if ((reading.frames[0]?.t ?? Infinity) < oldest) {
      reading.frames = reading.frames.filter((frame) => frame.t >= oldest);
      reading.startS = Math.max(reading.startS, oldest);
    }
  }

  /** The ball's path through everything read so far, for the drawing. */
  private track(reading: Reading) {
    const offsetS = this.timeline.segments[reading.index]?.offsetS ?? 0;
    const start = performance.now();
    const balls = trackClip(reading.frames, reading.size, this.config);
    reading.untracked = 0;
    this.store.set({
      points: balls.map((ball) => toBallPoint(ball, reading.size, offsetS)),
      frames: reading.frames.length,
      seen: balls.filter((ball) => ball.state === 'detected').length,
      trackMs: performance.now() - start,
    });
  }
}
