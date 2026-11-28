import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { toBase64Url } from '@/shared/lib/base64url';
import { randomBytes } from '@/shared/native/random';
import { type SetupForm, toMatchSetup } from '@/sports/tennis';

import { decodeSessionKey } from './logic/joinLink';
import { replayLog } from './logic/matchLog';
import type { GuestMessage, HostMessage } from './logic/messages';
import { SealedCodec } from './logic/SealedCodec';
import { BleGuest } from './native/ble/BleGuest';
import { nativeLanLink } from './native/lanLink';
import type { LinkStatus } from './native/Transport';
import { WifiGuest } from './native/wifi/WifiGuest';
import type { GuestSession } from './Session';
import { type CreateGuestLinks, type GuestState, SessionGuest } from './SessionGuest';

type In = HostMessage<SetupForm>;

/** The real links: Bluetooth and the local Wi-Fi, every message sealed with the session key. */
function guestLinks(sessionId: string, key: string): CreateGuestLinks {
  const bytes = decodeSessionKey(key);
  if (!bytes) throw new Error('Invalid session key');
  return {
    codec: () => new SealedCodec<In, GuestMessage>(bytes, randomBytes, 'guest'),
    bluetooth: (codec, { onMessage, onStatus, onConnected }) =>
      new BleGuest(sessionId, codec, onMessage, onStatus, onConnected),
    wifi: (codec, { onMessage, onStatus, onConnected }) =>
      new WifiGuest(sessionId, nativeLanLink, codec, onMessage, onStatus, onConnected),
  };
}

/** The link as a whole: by the one in use, or, before the first ping, by the transports. */
function overall({ via, health, status }: GuestState): LinkStatus {
  if (via) return 'connected';
  if (health.bluetooth || health.wifi) return 'lost'; // pinged before, nothing works now
  if (status.bluetooth === 'connected' || status.wifi === 'connected') return 'connected';
  if (status.bluetooth === 'connecting' || status.wifi === 'connecting') return 'connecting';
  return status.bluetooth === 'lost' ? 'lost' : 'searching';
}

/**
 * A guest's session: `SessionGuest` does the work, this wires it to React. `wifi`: the host's
 * addresses from the QR code.
 */
export function useGuestSession(sessionId: string, key: string, wifi: string[]): GuestSession {
  const [guest] = useState(
    () => new SessionGuest(toBase64Url(randomBytes(6)), wifi, guestLinks(sessionId, key)),
  );
  useEffect(() => {
    guest.start();
    return () => guest.stop();
  }, [guest]);
  const state = useSyncExternalStore(guest.store.subscribe, guest.store.get);
  const setup = useMemo(() => (state.form ? toMatchSetup(state.form) : undefined), [state.form]);
  const view = useMemo(() => (setup ? replayLog(setup, state.log) : undefined), [setup, state.log]);
  return {
    role: 'guest',
    sessionId,
    key,
    log: state.log,
    dispatch: guest.dispatch,
    link: overall(state),
    via: state.via,
    health: state.health,
    wifiKnown: state.wifiKnown,
    ...(state.form && { form: state.form }),
    ...(view && { view }),
  };
}
