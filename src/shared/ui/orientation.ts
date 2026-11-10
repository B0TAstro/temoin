import { lockAsync, OrientationLock } from 'expo-screen-orientation';
import { useEffect } from 'react';

/**
 * Menus are read in hand, in portrait. A session is landscape: the phone stands behind the
 * baseline, the camera films the width of the court and the score is read from a distance.
 */
export function useOrientation(orientation: 'portrait' | 'landscape') {
  useEffect(() => {
    if (orientation === 'portrait') {
      void lockAsync(OrientationLock.PORTRAIT_UP);
      return;
    }
    void lockAsync(OrientationLock.LANDSCAPE);
    return () => void lockAsync(OrientationLock.PORTRAIT_UP);
  }, [orientation]);
}
