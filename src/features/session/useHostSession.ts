import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { randomBytes } from '@/shared/native/random';
import { type SetupForm, toMatchSetup } from '@/sports/tennis';

import { decodeSessionKey } from './logic/joinLink';
import { replayLog } from './logic/matchLog';
import type { GuestMessage, HostMessage } from './logic/messages';
import { SealedCodec } from './logic/SealedCodec';
import { BleHost } from './native/ble/BleHost';
import { nativeLanLink } from './native/lanLink';
import { WifiHost } from './native/wifi/WifiHost';
import type { HostSession } from './Session';
import { type CreateHostLinks, SessionHost } from './SessionHost';

type Out = HostMessage<SetupForm>;

/** The real links: Bluetooth and the local Wi-Fi, every message sealed with the session key. */
function hostLinks(sessionId: string, key: string): CreateHostLinks {
  const bytes = decodeSessionKey(key);
  if (!bytes) throw new Error('Invalid session key');
  return {
    codec: () => new SealedCodec<GuestMessage, Out>(bytes, randomBytes, 'host'),
    // The guests are counted by their pongs, on every link: not by Bluetooth subscriptions
    bluetooth: (codec, onMessage) => new BleHost(sessionId, codec, onMessage, () => {}),
    wifi: (codec, onMessage) => new WifiHost(sessionId, nativeLanLink, codec, onMessage),
  };
}

/** The host's session: `SessionHost` does the work, this wires it to React. */
export function useHostSession(
  sessionId: string,
  key: string,
  form: SetupForm,
  phrase: string | undefined,
): HostSession {
  const [host] = useState(() => new SessionHost(form, hostLinks(sessionId, key)));
  useEffect(() => {
    host.start();
    return () => host.stop();
  }, [host]);
  const state = useSyncExternalStore(host.store.subscribe, host.store.get);
  const setup = useMemo(() => toMatchSetup(form), [form]);
  const view = useMemo(() => replayLog(setup, state.log), [setup, state.log]);
  return {
    role: 'host',
    sessionId,
    key,
    form,
    phrase,
    view,
    log: state.log,
    dispatch: host.dispatch,
    link: state.bluetooth ? 'connected' : 'off',
    wifi: state.wifi,
    guests: state.guests,
    byLink: state.byLink,
    rttMs: state.rttMs,
  };
}
