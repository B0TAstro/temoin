import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Measures the real fps from the camera timestamps (in seconds) of the received frames
 */
export function useFpsMeter(refreshMs = 500) {
  const timestamps = useRef<number[]>([]);
  const [fps, setFps] = useState(0);

  const onFrameTimestamp = useCallback((timestamp: number) => {
    const list = timestamps.current;
    list.push(timestamp);
    while (list.length > 0 && timestamp - (list[0] ?? timestamp) > 1) list.shift();
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const list = timestamps.current;
      const first = list[0];
      const last = list[list.length - 1];
      if (first != null && last != null && list.length >= 2) {
        const span = last - first;
        setFps(span > 0 ? (list.length - 1) / span : 0);
      }
    }, refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);

  return { fps, onFrameTimestamp };
}
