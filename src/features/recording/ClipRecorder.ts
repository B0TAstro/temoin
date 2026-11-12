import { Store } from '@/shared/lib/Store';

import { type Clip, ClipBuffer, type PointSnapshot } from './logic/ClipBuffer';
import type { Segment } from './logic/Segment';
import type { CreateVideoRecorder, VideoRecorder } from './native/VideoRecorder';

/** Finished points kept on disk, on top of the point being recorded: 3 points in all */
export const MAX_SAVED_POINTS = 2;
const TRIM_EVERY_MS = 5000;

export type ClipStats = {
  recording: boolean;
  savedCount: number;
  deletedCount: number;
  totalMB: number;
  errorCount: number;
};

/** What VAR shows: the finished points (newest first) and what was filmed of the current one */
export type ClipsForReplay = { finished: Clip[]; current: Clip };

const copy = (clip: Clip): Clip => ({ ...clip, segments: [...clip.segments] });

/** What the recorder is built with: the camera, and how to delete a file */
export type ClipRecorderDeps = {
  createRecorder: CreateVideoRecorder;
  deleteFile: (path: string) => void;
};

/**
 * One file per point, on disk. Wires the camera (a VideoRecorder) to the clip logic (ClipBuffer) and deletes the files the buffer lets go.
 * Tasks run in order: a cut waits for the next file
 */
export class ClipRecorder {
  private readonly buffer = new ClipBuffer(MAX_SAVED_POINTS);
  private readonly recorder: VideoRecorder;
  private readonly deleteFile: (path: string) => void;
  readonly stats: Store<ClipStats>;
  private chain: Promise<unknown> = Promise.resolve();
  private trimTimer: ReturnType<typeof setInterval> | undefined;

  constructor({ createRecorder, deleteFile }: ClipRecorderDeps) {
    this.deleteFile = deleteFile;
    this.recorder = createRecorder({
      onSegment: (segment) => this.delete(this.buffer.addSegment(segment)),
      onChange: () => this.refresh(),
    });
    this.stats = new Store(this.readStats());
  }

  start() {
    this.enqueue(async () => {
      this.recorder.start();
      clearInterval(this.trimTimer);
      this.trimTimer = setInterval(
        () => this.delete(this.buffer.trimCurrent(Date.now(), this.recorder.maxPointSeconds)),
        TRIM_EVERY_MS,
      );
    });
  }

  /** Replay, background: the file in progress is written, the point goes on afterwards */
  stop(): Promise<void> {
    return this.enqueue(async () => {
      clearInterval(this.trimTimer);
      await this.recorder.stop();
    });
  }

  /** End of a point: the file is cut */
  endPoint(point: PointSnapshot) {
    this.enqueue(async () => {
      const at = await this.recorder.cut();
      this.delete(this.buffer.endPoint(at, point));
    });
  }

  /** The proposed point was refused: its file goes back to the point that continues */
  retract() {
    this.enqueue(async () => this.buffer.retract());
  }

  /** VAR: stops recording, waits for every file to be written, and returns the clips */
  async freeze(): Promise<ClipsForReplay> {
    await this.stop();
    return { finished: this.buffer.finished.map(copy), current: copy(this.buffer.current) };
  }

  /** End of the match: every file is deleted */
  discard() {
    clearInterval(this.trimTimer);
    this.recorder.cancel();
    this.delete(this.buffer.clear());
  }

  private readStats(): ClipStats {
    return {
      recording: this.recorder.isRunning,
      savedCount: this.buffer.finished.length,
      deletedCount: this.buffer.deletedCount,
      totalMB: this.buffer.totalBytes / 1e6,
      errorCount: this.recorder.errorCount,
    };
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    const next = this.chain.then(task, task).finally(() => this.refresh());
    this.chain = next.catch((e) => console.warn('Clip task failed', e));
    return next;
  }

  /** Every change of the buffer goes through here or through a task: the stats follow */
  private delete(segments: Segment[]) {
    for (const segment of segments) this.deleteFile(segment.path);
    this.refresh();
  }

  private refresh() {
    this.stats.set(this.readStats());
  }
}
