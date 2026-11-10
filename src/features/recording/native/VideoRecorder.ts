import type { Segment } from '../logic/Segment';

/**
 * What the clips need from the camera: VisionCamera on the phone (SegmentRecorder), a fake one in
 * tests. It records one file per point and hands over every finished file; it keeps none.
 */
export interface VideoRecorder {
  readonly isRunning: boolean;
  readonly errorCount: number;
  /** A point nobody scores starts a new file after this long. */
  readonly maxPointSeconds: number;
  start(): void;
  /** Stops recording and waits until the files in progress are written, so they can be played. */
  stop(): Promise<void>;
  /** Cuts now, at the end of a point. Returns the instant of the cut (the start of the new file). */
  cut(): Promise<number>;
  /** Cancels the recordings in progress and deletes their files (end of the match). */
  cancel(): void;
}

export type RecorderEvents = {
  /** A file is fully written. */
  onSegment: (segment: Segment) => void;
  /** `isRunning` or `errorCount` changed. */
  onChange: () => void;
};

/** Builds the recorder (factory): the clips decide what to do with its events. */
export type CreateVideoRecorder = (events: RecorderEvents) => VideoRecorder;
