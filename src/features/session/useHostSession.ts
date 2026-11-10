import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { randomBytes } from '@/shared/native/random';
import { type SetupForm, toMatchSetup } from '@/sports/tennis';

import { HostLog } from './logic/hostLog';
import { decodeSessionKey } from './logic/joinLink';
import { type LoggedEvent, type MatchEvent, replayLog } from './logic/matchLog';
import type { GuestMessage, HostMessage } from './logic/messages';
import { SealedCodec } from './logic/SealedCodec';
import { BleHost } from './native/ble/BleHost';
import { LocalHost } from './native/LocalTransport';
import type { HostTransport } from './native/Transport';
import type { HostSession } from './Session';

/**
 * The host keeps the log (HostLog) and sends every new event to its guests. Works with no guest
 * at all, and with no Bluetooth: the match then goes on with no radio. Every message is sealed
 * with the session key.
 */
export function useHostSession(sessionId: string, key: string, form: SetupForm): HostSession {
  const setup = useMemo(() => toMatchSetup(form), [form]);
  const hostLog = useMemo(() => new HostLog(setup), [setup]);
  const [log, setLog] = useState<readonly LoggedEvent[]>(hostLog.events);
  const [link, setLink] = useState<HostSession['link']>('off');
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
    const bytes = decodeSessionKey(key);
    if (!bytes) throw new Error('Invalid session key');
    const codec = new SealedCodec<GuestMessage, HostMessage<SetupForm>>(bytes, randomBytes, 'host');
    const ble = new BleHost<GuestMessage, HostMessage<SetupForm>>(
      sessionId,
      codec,
      (message) => {
        if (message.t === 'intent') dispatch(message.event);
        else if (message.t === 'sync') {
          ble.broadcast({ t: 'snapshot', setup: form, log: [...hostLog.events] });
        }
        // anything else is not a guest message: ignored
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
  }, [sessionId, key, form, hostLog, dispatch]);

  const view = useMemo(() => replayLog(setup, log), [setup, log]);
  return { role: 'host', sessionId, key, form, view, log, dispatch, link, guests };
}
