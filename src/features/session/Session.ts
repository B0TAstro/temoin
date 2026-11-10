import type { LinkStatus } from './native/Transport';
import type { LoggedEvent, MatchEvent, MatchView } from './logic/matchLog';

import type { SetupForm } from '@/sports/tennis';

/** What the match screen sees of the session, the same on the host and on a guest. */
export type Session = {
  role: 'host' | 'guest';
  sessionId: string;
  /** The session key, shown in the host's QR code. */
  key: string;
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
