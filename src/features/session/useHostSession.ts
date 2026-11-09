import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BleHost } from '@/adapters/link/ble/BleHost';
import { LocalHost } from '@/adapters/link/LocalTransport';
import type { HostTransport, LinkStatus } from '@/adapters/link/Transport';
import { type LoggedEvent, type MatchEvent, replay } from '@/core/events/matchLog';
import { HostLog } from '@/core/protocol/hostLog';
import type { GuestMessage, HostMessage } from '@/core/protocol/messages';

import type { Session } from './Session';
import { type SetupForm, toSetup } from './setup';

/**
 * The host keeps the log (HostLog) and sends every new event to its guests. Works with no guest
 * at all, and with no Bluetooth: the match then goes on with no radio.
 */
export function useHostSession(sessionId: string, form: SetupForm): Session {
  const setup = useMemo(() => toSetup(form), [form]);
  const hostLog = useMemo(() => new HostLog(setup), [setup]);
  const [log, setLog] = useState<readonly LoggedEvent[]>(hostLog.events);
  const [link, setLink] = useState<LinkStatus | 'off'>('off');
  const [guests, setGuests] = useState(0);
  const transport = useRef<HostTransport<HostMessage<SetupForm>> | null>(null);

  const dispatch = useCallback(
    (event: MatchEvent) => {
      const logged = hostLog.receive(event);
      if (logged === null) return;
      setLog(hostLog.events);
      transport.current?.broadcast({ t: 'event', event: logged });
    },
    [hostLog],
  );

  useEffect(() => {
    const ble = new BleHost<GuestMessage, HostMessage<SetupForm>>(
      sessionId,
      (message) => {
        if (message.t === 'intent') dispatch(message.event);
        else ble.broadcast({ t: 'snapshot', setup: form, log: [...hostLog.events] });
      },
      setGuests,
    );
    transport.current = ble;
    let active = true;
    // No Bluetooth (refused, unavailable): the match goes on with no radio at all.
    const playAlone = () => {
      if (!active) return;
      ble.stop();
      transport.current = new LocalHost();
      setLink('off');
    };
    ble
      .start()
      .then((started) => (started ? setLink('connected') : playAlone()))
      .catch((e) => {
        console.warn('BLE host', e);
        playAlone();
      });
    return () => {
      active = false;
      transport.current?.stop();
      transport.current = null;
    };
  }, [sessionId, form, hostLog, dispatch]);

  const view = useMemo(() => replay(setup, log), [setup, log]);
  return { role: 'host', sessionId, form, view, log, dispatch, link, guests };
}
