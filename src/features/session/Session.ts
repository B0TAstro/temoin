import type { SetupForm } from '@/sports/tennis';

import type { LoggedEvent, MatchEvent, MatchView } from './logic/matchLog';
import type { LinkStatus } from './native/Transport';

/** What every phone of the session has, host or guest. */
type SessionBase = {
  sessionId: string;
  /** The session key, shown in the host's QR code. */
  key: string;
  log: readonly LoggedEvent[];
  /** Every change goes through here, on the host as on a guest. */
  dispatch: (event: MatchEvent) => void;
};

/** The phone that created the session: it knows the match from the start and keeps the log. */
export type HostSession = SessionBase & {
  role: 'host';
  form: SetupForm;
  view: MatchView;
  /** Bluetooth on (guests can join), or off: the match goes on with no radio. */
  link: 'connected' | 'off';
  guests: number;
};

/** A phone that scanned the QR code: it learns the match once the host has sent it. */
export type GuestSession = SessionBase & {
  role: 'guest';
  form?: SetupForm;
  view?: MatchView;
  link: LinkStatus;
};

export type Session = HostSession | GuestSession;

/** A session whose match is known: what the match screen shows. */
export type MatchSession = HostSession | (GuestSession & { form: SetupForm; view: MatchView });
