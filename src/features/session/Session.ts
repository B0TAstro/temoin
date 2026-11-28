import type { SetupForm } from '@/sports/tennis';

import type { LinkHealth } from './logic/linkHealth';
import type { LoggedEvent, MatchEvent, MatchView } from './logic/matchLog';
import type { LinkKind, LinkStatus } from './native/Transport';

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
  /** The session phrase, for a guest to type instead of scanning the QR code. */
  phrase: string | undefined;
  /** Bluetooth on (guests can join by it), or off: refused or unavailable. */
  link: 'connected' | 'off';
  /** Where guests reach this phone on the local Wi-Fi (`ip:port`); empty with no Wi-Fi. */
  wifi: string[];
  /** Guests that answered the last pings, on any link, and on each link. */
  guests: number;
  byLink: Record<LinkKind, number>;
  /** Last ping round trip on each link, in ms. */
  rttMs: Partial<Record<LinkKind, number>>;
};

/** A phone that scanned the QR code: it learns the match once the host has sent it. */
export type GuestSession = SessionBase & {
  role: 'guest';
  form?: SetupForm;
  view?: MatchView;
  /** The link to the host as a whole: connected by one link or the other, or not. */
  link: LinkStatus;
  /** The link the guest sends on; undefined: none works. */
  via: LinkKind | undefined;
  /** Each link, as the host's pings say (undefined: no ping by it yet). */
  health: Partial<Record<LinkKind, LinkHealth>>;
  /** Whether the host has a Wi-Fi address to try. */
  wifiKnown: boolean;
};

export type Session = HostSession | GuestSession;

/** A session whose match is known: what the match screen shows. */
export type MatchSession = HostSession | (GuestSession & { form: SetupForm; view: MatchView });
