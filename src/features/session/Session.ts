import type { LinkStatus } from '@/adapters/link/Transport';
import type { LoggedEvent, MatchEvent, MatchView } from '@/core/events/matchLog';

import type { SetupForm } from './setup';

/** What the match screen sees of the session, the same on the host and on a guest. */
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
