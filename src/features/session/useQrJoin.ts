import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  isScannedCode,
  type ScannedObject,
  type ScannedObjectType,
  useObjectOutput,
} from 'react-native-vision-camera';

import { type Join, parseJoinLink, toJoin } from './logic/joinLink';

const QR_TYPES: ScannedObjectType[] = ['qr'];

/**
 * Joining by the host's QR code: scanned by the camera (`scanner`, the camera output to mount),
 * or already in the route when the iPhone Camera app opened a lineo://join link. `invalid`: a QR
 * code was seen that is not a Lineo session
 */
export function useQrJoin(join: (session: Join) => void) {
  const params = useLocalSearchParams<{ s?: string; k?: string; v?: string; w?: string }>();
  const linked = toJoin(params);
  const [invalid, setInvalid] = useState(false);

  const linkedId = linked?.sessionId;
  const linkedKey = linked?.key;
  const linkedWifi = linked?.wifi.join(',');
  useEffect(() => {
    if (linkedId && linkedKey) {
      join({ sessionId: linkedId, key: linkedKey, wifi: linkedWifi ? linkedWifi.split(',') : [] });
    }
  }, [linkedId, linkedKey, linkedWifi, join]);

  const scanner = useObjectOutput({
    types: QR_TYPES,
    onObjectsScanned: (objects: ScannedObject[]) => {
      for (const object of objects) {
        const session = isScannedCode(object) && object.value ? parseJoinLink(object.value) : null;
        if (session) {
          join(session);
          return;
        }
      }
      setInvalid(true);
    },
  });

  return { scanner, invalid };
}
