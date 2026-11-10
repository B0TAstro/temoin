/** One video file on disk, written by the camera. Times come from the JS clock (`Date.now()`). */
export type Segment = {
  path: string;
  startedAt: number;
  endedAt: number;
  durationS: number;
  sizeBytes: number;
};
