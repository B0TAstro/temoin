import { COURT_CORNERS, COURT_LINES, type Reference, REFERENCE_CORNERS } from './courtModel';
import { homography, type Point, project } from './homography';
import { turned } from './orderCorners';

/**
 * A calibration, as the player left it: 4 points on the picture (fractions of its width and
 * height, already in order: top left, top right, bottom right, bottom left), the rectangle of the
 * court they stand for, and how many quarters it was turned
 */
export type Calibration = { corners: readonly Point[]; reference: Reference; turns: number };

/** A segment of the picture, in fractions */
export type Segment = { from: Point; to: Point };

/** The court drawn over the picture: its outline and lines, ready to draw */
export type CourtGeometry = { outline: Point[]; lines: Segment[] };

/** Court (cm) to picture (fractions), from the 4 points; undefined if they make no quadrilateral */
const courtToPicture = ({ corners, reference, turns }: Calibration) =>
  homography(turned(REFERENCE_CORNERS[reference], turns), corners);

export function courtGeometry(calibration: Calibration): CourtGeometry | undefined {
  const h = courtToPicture(calibration);
  if (!h) return undefined;
  const outline = COURT_CORNERS.map((corner) => project(h, corner));
  if (outline.some((p) => p === undefined)) return undefined;
  const lines: Segment[] = [];
  for (const { from, to } of COURT_LINES) {
    const a = project(h, from);
    const b = project(h, to);
    if (a && b) lines.push({ from: a, to: b });
  }
  return { outline: outline as Point[], lines };
}

/** Width added on each side of the court, as a share of its width at that height of the picture */
const SIDE_MARGIN = 0.35;

/**
 * Whether a point of the picture is on the court or near it: for the ball tracking, which keeps
 * only those. Worked out in the picture, not on the ground: a ball in the air is not on the ground
 * plane, and a lob above the far baseline must stay in. At each height of the picture, the court
 * spans between its outline's left and right edges (taken at the far baseline above it), widened
 * by a margin on each side; nothing is cut above or below. Stands and spectators at the sides go
 */
export function courtArea(geometry: CourtGeometry): (point: Point) => boolean {
  const { outline } = geometry;
  const top = Math.min(...outline.map((p) => p.y));
  const bottom = Math.max(...outline.map((p) => p.y));
  const edges = outline.map((from, i) => ({ from, to: outline[(i + 1) % outline.length] ?? from }));
  return ({ x, y }) => {
    const row = Math.min(Math.max(y, top), bottom);
    let left = Infinity;
    let right = -Infinity;
    for (const { from, to } of edges) {
      const low = Math.min(from.y, to.y);
      const high = Math.max(from.y, to.y);
      if (row < low || row > high || high === low) continue;
      const at = from.x + ((row - from.y) / (to.y - from.y)) * (to.x - from.x);
      left = Math.min(left, at);
      right = Math.max(right, at);
    }
    if (left > right) return true;
    const margin = (right - left) * SIDE_MARGIN;
    return x >= left - margin && x <= right + margin;
  };
}
