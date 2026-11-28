/** A point in the plane: court cm, or fractions of the picture */
export type Point = { x: number; y: number };

/** 3×3, row by row, h[8] = 1 */
export type Homography = readonly number[];

/**
 * The homography that takes 4 points exactly onto 4 others (as the POC: getPerspectiveTransform,
 * not a fit, with exactly 4 points). Solves the 8 unknowns by Gaussian elimination with partial
 * pivoting; undefined when the points are degenerate (3 in line).
 */
export function homography(from: readonly Point[], to: readonly Point[]): Homography | undefined {
  const rows: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i] ?? { x: 0, y: 0 };
    const { x: u, y: v } = to[i] ?? { x: 0, y: 0 };
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  const solution = solve(rows);
  return solution && [...solution, 1];
}

/** The homography the other way round */
export function invert(h: Homography): Homography | undefined {
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, k = 0, m = 0] = h;
  const det = a * (e * m - f * k) - b * (d * m - f * g) + c * (d * k - e * g);
  if (Math.abs(det) < 1e-12) return undefined;
  const inverse = [
    e * m - f * k,
    c * k - b * m,
    b * f - c * e,
    f * g - d * m,
    a * m - c * g,
    c * d - a * f,
    d * k - e * g,
    b * g - a * k,
    a * e - b * d,
  ].map((value) => value / det);
  const scale = inverse[8] ?? 1;
  return inverse.map((value) => value / scale);
}

/** Where a point lands; undefined behind the camera (or at the horizon) */
export function project(h: Homography, { x, y }: Point): Point | undefined {
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, k = 0, m = 1] = h;
  const w = g * x + k * y + m;
  if (w <= 1e-9) return undefined;
  return { x: (a * x + b * y + c) / w, y: (d * x + e * y + f) / w };
}

/** Gaussian elimination on an augmented n×(n+1) matrix */
function solve(rows: number[][]): number[] | undefined {
  const n = rows.length;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(rows[r]?.[col] ?? 0) > Math.abs(rows[pivot]?.[col] ?? 0)) pivot = r;
    }
    const top = rows[pivot];
    if (!top || Math.abs(top[col] ?? 0) < 1e-12) return undefined;
    [rows[col], rows[pivot]] = [top, rows[col] ?? top];
    for (let r = 0; r < n; r++) {
      const row = rows[r];
      if (r === col || !row) continue;
      const factor = (row[col] ?? 0) / (top[col] ?? 1);
      for (let c = col; c <= n; c++) row[c] = (row[c] ?? 0) - factor * (top[c] ?? 0);
    }
  }
  return rows.map((row, i) => (row[n] ?? 0) / (row[i] ?? 1));
}
