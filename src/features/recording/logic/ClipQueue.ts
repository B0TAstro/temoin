import type { Segment } from './Segment';

/** What the match log knows about the point that just ended. */
export type PointSnapshot = {
  /** Index of the point in the match (0 for the first point). */
  pointIndex: number;
  /** Score the point was played at, e.g. "Set 1 · Jeu 4 · 30-15". */
  label: string;
};

export type Clip = {
  id: number;
  /** JS clock of the cut that started this clip: every file started at or after it belongs here. */
  startAt: number;
  /** Set once the point has ended. */
  point?: PointSnapshot;
  /** One file per point; two when a proposed point was refused, more after the safety limit. */
  segments: Segment[];
  /** True when the safety limit dropped the beginning of the clip. */
  trimmed: boolean;
};

/**
 * One clip per point: the point being recorded plus the last `maxSaved` finished points.
 * Pure logic (no disk, no camera): methods return the files that must be deleted.
 */
export class ClipQueue {
  private nextId = 1;
  /** Newest first. */
  private done: Clip[] = [];
  private recording: Clip;
  private deleted = 0;

  constructor(
    private readonly maxSaved: number,
    startAt = Number.NEGATIVE_INFINITY,
  ) {
    this.recording = this.newClip(startAt);
  }

  get current(): Clip {
    return this.recording;
  }

  /** Finished points, newest first. */
  get finished(): readonly Clip[] {
    return this.done;
  }

  get deletedCount() {
    return this.deleted;
  }

  get totalBytes() {
    return [this.recording, ...this.done].reduce(
      (sum, clip) => sum + clip.segments.reduce((s, segment) => s + segment.sizeBytes, 0),
      0,
    );
  }

  /**
   * The point ended at `at`: the current clip becomes a finished point and a new clip starts.
   * Finished points beyond `maxSaved` are dropped, oldest first.
   */
  endPoint(at: number, point: PointSnapshot): Segment[] {
    this.recording.point = point;
    this.done.unshift(this.recording);
    this.recording = this.newClip(at);
    return this.drop(this.done.splice(this.maxSaved).flatMap((clip) => clip.segments));
  }

  /**
   * The proposed point was refused: the last finished point is recording again, and what was
   * filmed since is glued back to it.
   */
  retract() {
    const last = this.done.shift();
    if (!last) return;
    delete last.point;
    last.segments.push(...this.recording.segments);
    last.trimmed ||= this.recording.trimmed;
    this.recording = last;
  }

  /** Files a finished file under the clip it was recorded for. */
  addSegment(segment: Segment): Segment[] {
    const clip = [this.recording, ...this.done].find((c) => segment.startedAt >= c.startAt);
    if (!clip) return this.drop([segment]); // its point was already dropped
    clip.segments.push(segment);
    clip.segments.sort((a, b) => a.startedAt - b.startedAt);
    return [];
  }

  /** Safety limit for a point nobody scores: keeps only the last `maxS` seconds of it. */
  trimCurrent(now: number, maxS: number): Segment[] {
    const { segments } = this.recording;
    let excess = 0;
    // A file can go once the next one alone already covers `maxS` seconds up to `now`.
    while (now - (segments[excess + 1]?.startedAt ?? now) >= maxS * 1000) excess++;
    if (excess === 0) return [];
    this.recording.trimmed = true;
    return this.drop(segments.splice(0, excess));
  }

  /** End of the match: every clip goes. */
  clear(): Segment[] {
    const all = [this.recording, ...this.done].flatMap((clip) => clip.segments);
    this.done = [];
    this.recording = this.newClip(Number.NEGATIVE_INFINITY);
    return this.drop(all);
  }

  private newClip(startAt: number): Clip {
    return { id: this.nextId++, startAt, segments: [], trimmed: false };
  }

  private drop(segments: Segment[]): Segment[] {
    this.deleted += segments.length;
    return segments;
  }
}
