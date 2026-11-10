import type { CameraVideoOutput } from 'react-native-vision-camera';

import { MAX_POINT_SECONDS, SegmentRecorder } from './native/SegmentRecorder';
import { deleteFile } from '@/shared/native/files';
import { type Clip, ClipQueue, type PointSnapshot } from './logic/ClipQueue';
import type { Segment } from './logic/Segment';

/** Finished points kept on disk, on top of the point being recorded: 3 points in all. */
export const MAX_SAVED_POINTS = 2;
const TRIM_EVERY_MS = 5000;

export type ClipStats = {
  recording: boolean;
  savedCount: number;
  deletedCount: number;
  totalMB: number;
  errorCount: number;
};

/** What VAR shows: the finished points (newest first) and what was filmed of the current one. */
export type ClipsForReplay = { finished: Clip[]; current: Clip };

const copy = (clip: Clip): Clip => ({ ...clip, segments: [...clip.segments] });

/**
 * One file per point, on disk. Wires the camera (SegmentRecorder) to the clip logic (ClipQueue)
 * and deletes the files the queue lets go. Tasks run in order: a cut waits for the next file.
 */
export class ClipRecorder {
  private readonly queue = new ClipQueue(MAX_SAVED_POINTS);
  private readonly recorder: SegmentRecorder;
  private chain: Promise<unknown> = Promise.resolve();
  private trimTimer: ReturnType<typeof setInterval> | undefined;

  constructor(videoOutput: CameraVideoOutput) {
    this.recorder = new SegmentRecorder(videoOutput, (segment) =>
      this.delete(this.queue.addSegment(segment)),
    );
  }

  start() {
    this.enqueue(async () => {
      this.recorder.start();
      clearInterval(this.trimTimer);
      this.trimTimer = setInterval(
        () => this.delete(this.queue.trimCurrent(Date.now(), MAX_POINT_SECONDS)),
        TRIM_EVERY_MS,
      );
    });
  }

  /** Replay, background: the file in progress is written, the point goes on afterwards. */
  stop(): Promise<void> {
    return this.enqueue(async () => {
      clearInterval(this.trimTimer);
      await this.recorder.stop();
    });
  }

  /** End of a point (its proposal): the file is cut. */
  endPoint(point: PointSnapshot) {
    this.enqueue(async () => {
      const at = await this.recorder.cut();
      this.delete(this.queue.endPoint(at, point));
    });
  }

  /** The proposed point was refused: its file goes back to the point that continues. */
  retract() {
    this.enqueue(async () => this.queue.retract());
  }

  /** VAR: stops recording, waits for every file to be written, and returns the clips. */
  async freeze(): Promise<ClipsForReplay> {
    await this.stop();
    return { finished: this.queue.finished.map(copy), current: copy(this.queue.current) };
  }

  /** End of the match: every file is deleted. */
  discard() {
    clearInterval(this.trimTimer);
    this.recorder.cancel();
    this.delete(this.queue.clear());
  }

  getStats(): ClipStats {
    return {
      recording: this.recorder.isRunning,
      savedCount: this.queue.finished.length,
      deletedCount: this.queue.deletedCount,
      totalMB: this.queue.totalBytes / 1e6,
      errorCount: this.recorder.errorCount,
    };
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    const next = this.chain.then(task, task);
    this.chain = next.catch((e) => console.warn('Clip task failed', e));
    return next;
  }

  private delete(segments: Segment[]) {
    for (const segment of segments) deleteFile(segment.path);
  }
}
