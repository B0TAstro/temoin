import { Directory, File } from 'expo-file-system';
import { Platform } from 'react-native';
import type { CameraVideoOutput, Recorder } from 'react-native-vision-camera';

import { deleteFile, fileSize, toUri } from '@/shared/native/files';

import type { RecorderEvents, VideoRecorder } from './VideoRecorder';

/** Safety limit */
export const MAX_POINT_SECONDS = 300;
/** The file may run a little past the safety limit, so the cut always happens before it stops */
const MAX_DURATION_MARGIN_SECONDS = 0.5;
/**
 * CameraX allows one active recording per Recorder, and VisionCamera has one Recorder per output:
 * on Android the previous file must stop before the next one starts, leaving a short gap between two points.
 * On iOS the persistent recorder accepts several recorders, so the files overlap
 */
const CAN_OVERLAP = Platform.OS === 'ios';
/** Upper bound for finalizing the files in progress: past it, the stuck recorder is cancelled */
const FINALIZE_TIMEOUT_MS = 5000;

type ActiveSegment = {
  startedAt?: number;
  started: Promise<void>;
  finished: Promise<void>;
};

/** Deletes videos left in the recording folder by a previous session (crash, app killed) */
function purgeStaleRecordings(currentPath: string) {
  try {
    const dir = new File(toUri(currentPath)).parentDirectory;
    for (const entry of new Directory(dir.uri).list()) {
      const isVideo = entry.name.endsWith('.mov') || entry.name.endsWith('.mp4');
      if (entry instanceof File && isVideo && !currentPath.endsWith(entry.name)) entry.delete();
    }
  } catch (e) {
    console.warn('Could not purge stale recordings', e);
  }
}

/**
 * Records one file per point: the file is cut at the end of the point, and only then (or at the safety limit).
 * It keeps nothing: every finished file is handed to `onSegment`, and the caller decides which ones to keep
 */
export class SegmentRecorder implements VideoRecorder {
  private active = new Map<Recorder, ActiveSegment>();
  private running = false;
  private errors = 0;
  private purged = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private cutting: Promise<number> | undefined;

  constructor(
    private readonly videoOutput: CameraVideoOutput,
    private readonly events: RecorderEvents,
    readonly maxPointSeconds = MAX_POINT_SECONDS,
  ) {}

  get isRunning() {
    return this.running;
  }

  get errorCount() {
    return this.errors;
  }

  start() {
    if (this.running) return;
    this.setRunning(true);
    this.startSegment();
  }

  async stop(): Promise<void> {
    this.setRunning(false);
    clearTimeout(this.timer);
    await this.finish([...this.active.entries()]);
  }

  cut(): Promise<number> {
    if (!this.running) return Promise.resolve(Date.now());
    this.cutting ??= this.doCut().finally(() => (this.cutting = undefined));
    return this.cutting;
  }

  private async doCut(): Promise<number> {
    const previous = [...this.active.entries()];
    clearTimeout(this.timer);
    if (CAN_OVERLAP) {
      const startedAt = (await this.startSegment()) ?? Date.now();
      await this.finish(previous);
      return startedAt;
    }
    await this.finish(previous);
    return (await this.startSegment()) ?? Date.now();
  }

  cancel() {
    this.setRunning(false);
    clearTimeout(this.timer);
    for (const recorder of this.active.keys()) recorder.cancelRecording().catch(() => {});
    this.active.clear();
  }

  private setRunning(running: boolean) {
    if (this.running === running) return;
    this.running = running;
    this.events.onChange();
  }

  private addError() {
    this.errors += 1;
    this.events.onChange();
  }

  private async finish(entries: [Recorder, ActiveSegment][]) {
    const pending = entries.map(async ([recorder, segment]) => {
      await segment.started;
      if (recorder.isRecording) await recorder.stopRecording().catch(() => {});
      await segment.finished;
    });
    let timedOut = false;
    const timeout = new Promise<void>((resolve) =>
      setTimeout(() => {
        timedOut = true;
        resolve();
      }, FINALIZE_TIMEOUT_MS),
    );
    await Promise.race([Promise.all(pending), timeout]);
    if (!timedOut) return;
    for (const [recorder] of entries) {
      if (!this.active.has(recorder)) continue;
      this.addError();
      this.active.delete(recorder);
      await recorder.cancelRecording().catch(() => {});
    }
  }

  /** Starts one file. Resolves with its start time, or undefined if it could not start */
  private async startSegment(): Promise<number | undefined> {
    if (!this.running) return undefined;
    this.timer = setTimeout(() => this.cut(), this.maxPointSeconds * 1000);

    let recorder: Recorder;
    try {
      recorder = await this.videoOutput.createRecorder({
        maxDuration: this.maxPointSeconds + MAX_DURATION_MARGIN_SECONDS,
      });
    } catch (e) {
      this.addError();
      console.warn('Could not create recorder', e);
      return undefined;
    }
    if (!this.running) return undefined;
    if (!this.purged) {
      this.purged = true;
      purgeStaleRecordings(recorder.filePath);
    }

    let markStarted!: () => void;
    let markFinished!: () => void;
    const segment: ActiveSegment = {
      started: new Promise((resolve) => (markStarted = resolve)),
      finished: new Promise((resolve) => (markFinished = resolve)),
    };
    this.active.set(recorder, segment);

    const onFinished = (path: string) => {
      const wasTracked = this.active.delete(recorder);
      if (!wasTracked) {
        deleteFile(path); // cancelled while finishing
      } else {
        const endedAt = Date.now();
        this.events.onSegment({
          path,
          startedAt: segment.startedAt ?? endedAt,
          endedAt,
          durationS: recorder.recordedDuration,
          sizeBytes: fileSize(path),
        });
      }
      markFinished();
    };
    const onError = (error: Error) => {
      this.active.delete(recorder);
      this.addError();
      console.warn('Recording error', error);
      markFinished();
    };

    try {
      await recorder.startRecording(onFinished, onError);
      segment.startedAt = Date.now();
      return segment.startedAt;
    } catch (e) {
      this.active.delete(recorder);
      this.addError();
      console.warn('Could not start recording', e);
      markFinished();
      return undefined;
    } finally {
      markStarted();
    }
  }
}
