import { router } from 'expo-router';
import { useRef } from 'react';

import type { Join } from './logic/joinLink';

/**
 * Joining as a guest, by whatever way: opens the match screen with the session, once (a QR code
 * seen on several frames, or a phrase sent while the camera still scans, joins only one time)
 */
export function useGuestJoin(): (join: Join) => void {
  const joined = useRef(false);
  return ({ sessionId, key, wifi }) => {
    if (joined.current) return;
    joined.current = true;
    // replace: the joining screen unmounts and frees the camera for the match screen
    router.replace({
      pathname: '/match',
      params: { role: 'guest', s: sessionId, k: key, w: wifi.join(',') },
    });
  };
}
