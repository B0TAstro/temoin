import { Directory, File } from 'expo-file-system';
import { Platform } from 'react-native';
import type { CameraVideoOutput, Recorder } from 'react-native-vision-camera';

import { deleteFile, fileSize, toUri } from '@/shared/native/files';

import type { Segment } from '../logic/Segment';

/**
 * Safety limit: a point nobody scores (forgotten tap, changeover) starts a new file after this
 * long, so a file never grows without bound. The replay then shows the last few minutes.
 */
export const MAX_POINT_SECONDS = 300;
/** The file may run a little past the safety limit, so the cut always happens before it stops. */
const MAX_DURATION_MARGIN_SECONDS = 0.5;
/**
 * CameraX allows one active recording per Recorder, and VisionCamera has one Recorder per output:
 * on Android the previous file must stop before the next one starts, leaving a short gap between
 * two points. On iOS the persistent recorder accepts several recorders, so the files overlap.
 */
const CAN_OVERLAP = Platform.OS === 'ios';
/** Upper bound for finalizing the files in progress: past it, the stuck recorder is cancelled. */
const FINALIZE_TIMEOUT_MS = 5000;

type ActiveSegment = {
  startedAt?: number;
  /** Start of the file recorded right after this one, in the same run (for the overlap stat). */
  nextStartedAt?: number;
  /** Resolves once the recorder has actually started (or failed to). */
  started: Promise<void>;
  /** Resolves once the file is fully written (or recording failed). */
  finished: Promise<void>;
};

/** Deletes videos left in the recording folder by a previous session (crash, app killed). */
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
 * Records one file per point: the file is cut at the end of the point, and only then (or at the
 * safety limit). It keeps nothing: every finished file is handed to `onSegment`, and the caller
 * decides which ones to keep. The hardware encoder writes straight to disk, nothing is in memory.
 */
export class SegmentRecorder {
  private active = new Map<Recorder, ActiveSegment>();
  private last: ActiveSegment | undefined;
  private running = false;
  private purged = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** The cut in progress: a second request (double tap, safety limit) joins it. */
  private cutting: Promise<number> | undefined;
  /** When the last file finished, to measure the gap at the next start (Android). */
  private lastEndedAt: number | undefined;
  errorCount = 0;
  /**
   * Overlap between the last two consecutive files, in ms (negative: a gap). Approximate: it uses
   * the JS clock of the callbacks, not the timestamps of the frames.
   */
  lastOverlapMs: number | undefined;

  constructor(
    private readonly videoOutput: CameraVideoOutput,
    private readonly onSegment: (segment: Segment) => void,
    private readonly maxPointSeconds = MAX_POINT_SECONDS,
  ) {}

  get isRunning() {
    return this.running;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = undefined;
    this.startSegment();
  }

  /** Stops recording and waits until the files in progress are written, so they can be played. */
  async stop(): Promise<void> {
    this.running = false;
    this.last = undefined;
    clearTimeout(this.timer);
    await this.finish([...this.active.entries()]);
  }

  /**
   * Cuts now, at the end of a point. Returns the instant of the cut (the start of the new file):
   * everything recorded before belongs to the previous point.
   */
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

  /** Cancels the recordings in progress and deletes their files (end of the match). */
  cancel() {
    this.running = false;
    this.last = undefined;
    clearTimeout(this.timer);
    for (const recorder of this.active.keys()) recorder.cancelRecording().catch(() => {});
    this.active.clear();
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
    // A recorder that never finished would block the next one on Android: give up on its file.
    for (const [recorder] of entries) {
      if (!this.active.has(recorder)) continue;
      this.errorCount += 1;
      this.active.delete(recorder);
      await recorder.cancelRecording().catch(() => {});
    }
  }

  /** Starts one file. Resolves with its start time, or undefined if it could not start. */
  private async startSegment(): Promise<number | undefined> {
    if (!this.running) return undefined;
    // Safety limit, scheduled before awaiting this file's start so start-up latency does not count.
    this.timer = setTimeout(() => this.cut(), this.maxPointSeconds * 1000);

    let recorder: Recorder;
    try {
      recorder = await this.videoOutput.createRecorder({
        maxDuration: this.maxPointSeconds + MAX_DURATION_MARGIN_SECONDS,
      });
    } catch (e) {
      this.errorCount += 1;
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
        this.lastEndedAt = endedAt;
        if (segment.nextStartedAt != null) this.lastOverlapMs = endedAt - segment.nextStartedAt;
        this.onSegment({
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
      this.errorCount += 1;
      console.warn('Recording error', error);
      markFinished();
    };

    try {
      await recorder.startRecording(onFinished, onError);
      segment.startedAt = Date.now();
      if (this.last) this.last.nextStartedAt = segment.startedAt;
      // Android: the previous file already finished, so the gap is known now.
      if (!CAN_OVERLAP && this.last && this.lastEndedAt != null)
        this.lastOverlapMs = this.lastEndedAt - segment.startedAt;
      this.last = segment;
      return segment.startedAt;
    } catch (e) {
      this.active.delete(recorder);
      this.errorCount += 1;
      console.warn('Could not start recording', e);
      markFinished();
      return undefined;
    } finally {
      markStarted();
    }
  }
}
