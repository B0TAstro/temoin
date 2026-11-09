import {
  isValid,
  type LoggedEvent,
  type MatchEvent,
  type MatchSetup,
  replay,
} from '@/core/events/matchLog';

/**
 * The host's side of the protocol: the one log of the session. Every change, the host's own as
 * its guests' intents, takes the same path: checked against the latest log, then numbered. The
 * caller sends the numbered event to every guest.
 */
export class HostLog {
  private log: LoggedEvent[] = [];

  constructor(private readonly setup: MatchSetup) {}

  get events(): readonly LoggedEvent[] {
    return this.log;
  }

  /** The event, numbered and added to the log; null when it changes nothing (stale, invalid). */
  receive(event: MatchEvent): LoggedEvent | null {
    if (!isValid(replay(this.setup, this.log), event)) return null;
    const logged = { ...event, seq: this.log.length + 1 } as LoggedEvent;
    this.log = [...this.log, logged];
    return logged;
  }
}
