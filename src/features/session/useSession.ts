import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BleGuest, BleHost, type LinkStatus } from '@/adapters/link/ble';
import {
  isValid,
  type LoggedEvent,
  type MatchEvent,
  type MatchView,
  replay,
} from '@/core/events/matchLog';
import type { GuestMessage, HostMessage } from '@/core/protocol/messages';

import { type SetupForm, toSetup } from './setup';

export type Session = {
  role: 'host' | 'guest';
  sessionId: string;
  /** Undefined on a guest until the host has sent the match. */
  form?: SetupForm;
  view?: MatchView;
  log: readonly LoggedEvent[];
  /** Every change goes through here, on the host as on a guest. */
  dispatch: (event: MatchEvent) => void;
  /** Host: Bluetooth on or not. Guest: link to the host. */
  link: LinkStatus | 'off';
  /** Host only: guests connected. */
  guests: number;
};

/**
 * The host keeps the log. Its own actions and its guests' intents take the same path: checked
 * against the latest log, numbered, then sent to every guest. Works with no guest at all.
 */
export function useHostSession(sessionId: string, form: SetupForm): Session {
  const setup = useMemo(() => toSetup(form), [form]);
  const [log, setLog] = useState<LoggedEvent[]>([]);
  const logRef = useRef<LoggedEvent[]>([]);
  const [link, setLink] = useState<LinkStatus | 'off'>('off');
  const [guests, setGuests] = useState(0);
  const host = useRef<BleHost<GuestMessage, HostMessage<SetupForm>> | null>(null);

  const dispatch = useCallback(
    (event: MatchEvent) => {
      const current = logRef.current;
      if (!isValid(replay(setup, current), event)) return;
      const logged = { ...event, seq: current.length + 1 } as LoggedEvent;
      logRef.current = [...current, logged];
      setLog(logRef.current);
      host.current?.send({ t: 'event', event: logged });
    },
    [setup],
  );

  useEffect(() => {
    const ble = new BleHost<GuestMessage, HostMessage<SetupForm>>(
      sessionId,
      (message) => {
        if (message.t === 'intent') dispatch(message.event);
        else ble.send({ t: 'snapshot', setup: form, log: logRef.current });
      },
      setGuests,
    );
    host.current = ble;
    ble
      .start()
      .then((started) => setLink(started ? 'connected' : 'off'))
      .catch((e) => {
        console.warn('BLE host', e);
        setLink('off');
      });
    return () => {
      ble.stop();
      host.current = null;
    };
  }, [sessionId, form, dispatch]);

  const view = useMemo(() => replay(setup, log), [setup, log]);
  return { role: 'host', sessionId, form, view, log, dispatch, link, guests };
}

/**
 * A guest mirrors the host's log. Its actions are sent to the host as intents and only count
 * once the host sends them back as events. A missing event triggers a full resync.
 */
export function useGuestSession(sessionId: string): Session {
  const [form, setForm] = useState<SetupForm>();
  const [log, setLog] = useState<LoggedEvent[]>([]);
  const [link, setLink] = useState<LinkStatus | 'off'>('searching');
  const guest = useRef<BleGuest<HostMessage<SetupForm>, GuestMessage> | null>(null);

  useEffect(() => {
    const ble = new BleGuest<HostMessage<SetupForm>, GuestMessage>(
      sessionId,
      (message) => {
        if (message.t === 'snapshot') {
          setForm(message.setup);
          setLog(message.log);
          return;
        }
        setLog((previous) => {
          if (message.event.seq <= previous.length) return previous; // already have it
          if (message.event.seq === previous.length + 1) return [...previous, message.event];
          ble.send({ t: 'sync' }); // one was lost
          return previous;
        });
      },
      setLink,
      () => ble.send({ t: 'sync' }),
    );
    guest.current = ble;
    ble.start().catch((e) => {
      console.warn('BLE guest', e);
      setLink('lost');
    });
    return () => {
      ble.stop();
      guest.current = null;
    };
  }, [sessionId]);

  const dispatch = useCallback((event: MatchEvent) => {
    guest.current?.send({ t: 'intent', event });
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
