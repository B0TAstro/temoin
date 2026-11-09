import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BleGuest } from '@/adapters/link/ble/BleGuest';
import type { GuestTransport, LinkStatus } from '@/adapters/link/Transport';
import { type LoggedEvent, type MatchEvent, replay } from '@/core/events/matchLog';
import { receiveEvent } from '@/core/protocol/guestLog';
import type { GuestMessage, HostMessage } from '@/core/protocol/messages';

import type { Session } from './Session';
import { type SetupForm, toSetup } from './setup';

/**
 * A guest mirrors the host's log. Its actions are sent to the host as intents and only count
 * once the host sends them back as events. A missing event triggers a full resync.
 */
export function useGuestSession(sessionId: string): Session {
  const [form, setForm] = useState<SetupForm>();
  const [log, setLog] = useState<readonly LoggedEvent[]>([]);
  const logRef = useRef<readonly LoggedEvent[]>([]);
  const [link, setLink] = useState<LinkStatus | 'off'>('searching');
  const transport = useRef<GuestTransport<GuestMessage> | null>(null);

  useEffect(() => {
    const ble = new BleGuest<HostMessage<SetupForm>, GuestMessage>(
      sessionId,
      (message) => {
        if (message.t === 'snapshot') {
          setForm(message.setup);
          logRef.current = message.log;
        } else {
          const received = receiveEvent(logRef.current, message.event);
          if (received.gap) ble.send({ t: 'sync' });
          logRef.current = received.log;
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
  }, [sessionId]);

  const dispatch = useCallback((event: MatchEvent) => {
    transport.current?.send({ t: 'intent', event });
  }, []);

  const setup = useMemo(() => (form ? toSetup(form) : undefined), [form]);
  const view = useMemo(() => (setup ? replay(setup, log) : undefined), [setup, log]);
  return {
    role: 'guest',
    sessionId,
    log,
    dispatch,
    link,
    guests: 0,
    ...(form && { form }),
    ...(view && { view }),
  };
}
