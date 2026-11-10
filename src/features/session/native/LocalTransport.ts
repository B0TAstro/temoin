import type { HostTransport } from './Transport';

/**
 * A host with no radio: a phone on its own, or Bluetooth refused. The match runs the same way,
 * there is just nobody to send to.
 */
export class LocalHost<Out> implements HostTransport<Out> {
  start(): Promise<boolean> {
    return Promise.resolve(true);
  }

  broadcast(_message: Out): void {}

  stop(): void {}
}
