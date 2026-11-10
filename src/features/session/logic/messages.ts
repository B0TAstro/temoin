import type { LoggedEvent, MatchEvent } from './matchLog';

/**
 * Messages between phones. Star topology: guests only talk to the host. Never any video.
 *
 * - A guest asks for the whole log when it connects, or when it notices a missing event.
 * - The host sends every new event to all guests, and the whole log when one asks.
 */
export type GuestMessage = { t: 'intent'; event: MatchEvent } | { t: 'sync' };

export type HostMessage<Setup> =
  { t: 'snapshot'; setup: Setup; log: LoggedEvent[] } | { t: 'event'; event: LoggedEvent };

/** 2: every message is sealed with the session key from the QR code. */
export const PROTOCOL_VERSION = 2;
