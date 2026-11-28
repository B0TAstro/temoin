import type { Point } from './homography';

type Size = { width: number; height: number };

/**
 * Where a picture of `picture` size lies in a view of `view` size: `contain` shows it whole with
 * bands, `cover` fills the view and crops it. Fractions of the picture to view points, and back
 */
export function fit(view: Size, picture: Size, mode: 'contain' | 'cover') {
  const pick = mode === 'contain' ? Math.min : Math.max;
  const scale = pick(view.width / picture.width, view.height / picture.height) || 0;
  const width = picture.width * scale;
  const height = picture.height * scale;
  const left = (view.width - width) / 2;
  const top = (view.height - height) / 2;
  return {
    toView: ({ x, y }: Point): Point => ({ x: left + x * width, y: top + y * height }),
    toPicture: ({ x, y }: Point): Point => ({
      x: width > 0 ? (x - left) / width : 0,
      y: height > 0 ? (y - top) / height : 0,
    }),
  };
}
