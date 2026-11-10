import type { LoggedEvent } from './matchLog';

export type Received = {
  log: readonly LoggedEvent[];
  /** An event was skipped: the guest asks the host for the whole log. */
  gap: boolean;
};

/**
 * The guest's side of the protocol: events are applied in the order of their numbers. One already
 * applied is ignored (the host sent it twice); one too far ahead means another was lost.
 */
export function receiveEvent(log: readonly LoggedEvent[], event: LoggedEvent): Received {
  if (event.seq <= log.length) return { log, gap: false };
  if (event.seq === log.length + 1) return { log: [...log, event], gap: false };
  return { log, gap: true };
}

/**
 * The whole log from the host, unless it is shorter than the one the guest has: the log only
 * grows, so a shorter one can only be an old snapshot sent back by someone else.
 */
export const receiveSnapshot = (
  log: readonly LoggedEvent[],
  snapshot: readonly LoggedEvent[],
): readonly LoggedEvent[] => (snapshot.length < log.length ? log : snapshot);
