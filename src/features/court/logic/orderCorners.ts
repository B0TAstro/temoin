import type { Point } from './homography';

/**
 * The 4 points in the picture's order whatever the order they were placed in (POC's
 * order_corners): around their centre, starting from the one nearest the top left. Then top left,
 * top right, bottom right, bottom left
 */
export function orderCorners(points: readonly Point[]): Point[] {
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  const around = [...points].sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
  );
  let first = 0;
  around.forEach((p, i) => {
    const best = around[first] ?? p;
    if (p.x + p.y < best.x + best.y) first = i;
  });
  return [...around.slice(first), ...around.slice(0, first)];
}

/**
 * The court's symmetry cannot be told from the picture (POC's finding, not to undo): which corner
 * of the court each picture corner is. `turns` (0 to 3) shifts it by a quarter each time, the
 * « Tourner » button: 0 is a camera behind the near baseline, 1 and 3 a camera at the side
 */
export const turned = <T>(corners: readonly T[], turns: number): T[] =>
  corners.map((_, i) => corners[(i + turns) % corners.length] as T);
