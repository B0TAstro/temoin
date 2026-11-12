import type { Segment } from '../logic/Segment';

/**
 * What the clips need from the camera: VisionCamera on the phone (SegmentRecorder), a fake one in tests.
 * It records one file per point and hands over every finished file, it keeps none
 */
export interface VideoRecorder {
  readonly isRunning: boolean;
  readonly errorCount: number;
  readonly maxPointSeconds: number;
  start(): void;
  stop(): Promise<void>;
  cut(): Promise<number>;
  cancel(): void;
}

export type RecorderEvents = {
  onSegment: (segment: Segment) => void;
  onChange: () => void;
};

/** Builds the recorder (factory): the clips decide what to do with its events */
export type CreateVideoRecorder = (events: RecorderEvents) => VideoRecorder;
