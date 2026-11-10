/**
 * What the session needs from a link between phones, whatever carries it: Bluetooth today, the
 * local Wi-Fi later (v0.6), nothing at all for a phone on its own. The protocol (what is sent,
 * in which order) lives above, in the session; a transport only carries the messages.
 *
 * Each transport takes its callbacks (messages received, guests, link status) in its constructor.
 */

/** A guest's link to the host. */
export type LinkStatus = 'searching' | 'connecting' | 'connected' | 'lost';

/** The host's side: receives from every guest, sends to all of them at once. */
export interface HostTransport<Out> {
  /** False when the link cannot run (permission refused): the host then plays on its own. */
  start(): Promise<boolean>;
  broadcast(message: Out): void;
  stop(): void;
}

/** A guest's side: talks to the host only. */
export interface GuestTransport<Out> {
  start(): Promise<boolean>;
  send(message: Out): void;
  stop(): void;
}
