import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { randomBytes } from '@/shared/native/random';
import { type SetupForm, toMatchSetup } from '@/sports/tennis';

import { receiveEvent, receiveSnapshot } from './logic/guestLog';
import { decodeSessionKey } from './logic/joinLink';
import { type LoggedEvent, type MatchEvent, replayLog } from './logic/matchLog';
import type { GuestMessage, HostMessage } from './logic/messages';
import { SealedCodec } from './logic/SealedCodec';
import { BleGuest } from './native/ble/BleGuest';
import type { GuestTransport, LinkStatus } from './native/Transport';
import type { Session } from './Session';

/**
 * A guest mirrors the host's log. Its actions are sent to the host as intents and only count
 * once the host sends them back as events. A missing event triggers a full resync.
 */
export function useGuestSession(sessionId: string, key: string): Session {
  const [form, setForm] = useState<SetupForm>();
  const [log, setLog] = useState<readonly LoggedEvent[]>([]);
  const logRef = useRef<readonly LoggedEvent[]>([]);
  const [link, setLink] = useState<LinkStatus | 'off'>('searching');
  const transport = useRef<GuestTransport<GuestMessage> | null>(null);

  useEffect(() => {
    const bytes = decodeSessionKey(key);
    if (!bytes) throw new Error('Invalid session key');
    const codec = new SealedCodec<HostMessage<SetupForm>, GuestMessage>(
      bytes,
      randomBytes,
      'guest',
    );
    const ble = new BleGuest<HostMessage<SetupForm>, GuestMessage>(
      sessionId,
      codec,
      (message) => {
        if (message.t === 'snapshot') {
          setForm(message.setup);
          logRef.current = receiveSnapshot(logRef.current, message.log);
        } else if (message.t === 'event') {
          const received = receiveEvent(logRef.current, message.event);
          if (received.gap) ble.send({ t: 'sync' });
          logRef.current = received.log;
        } else {
          return; // not a host message: ignored
        }
        setLog(logRef.current);
      },
      setLink,
      () => ble.send({ t: 'sync' }),
    );
    transport.current = ble;
    ble.start().catch((e) => {
      console.warn('BLE guest', e);
      setLink('lost');
    });
    return () => {
      ble.stop();
      transport.current = null;
    };
  }, [sessionId, key]);

  const dispatch = useCallback((event: MatchEvent) => {
    transport.current?.send({ t: 'intent', event });
  }, []);

  const setup = useMemo(() => (form ? toMatchSetup(form) : undefined), [form]);
  const view = useMemo(() => (setup ? replayLog(setup, log) : undefined), [setup, log]);
  return {
    role: 'guest',
    sessionId,
    key,
    log,
    dispatch,
    link,
    guests: 0,
    ...(form && { form }),
    ...(view && { view }),
  };
}
