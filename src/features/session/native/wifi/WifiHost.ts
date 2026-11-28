import type { Codec } from '../../logic/codec';
import { type LanLink, serviceName } from '../lanLink';
import type { HostTransport } from '../Transport';

/**
 * The host on the local Wi-Fi: listens on a free port, on every interface (the club's Wi-Fi, or
 * its own personal hotspot), and sends each message to every guest connected. A connection that
 * sends a line not sealed with the session key is a stranger on the network: closed. It is also
 * announced over mDNS under the session's code, for a guest that has only the phrase.
 */
export class WifiHost<In, Out> implements HostTransport<Out> {
  private readonly guests = new Set<string>();
  private unsubscribe: (() => void)[] = [];
  private port = 0;

  constructor(
    private readonly sessionId: string,
    private readonly lan: LanLink,
    private readonly codec: Codec<In, Out>,
    private readonly onMessage: (message: In) => void,
  ) {}

  async start(): Promise<boolean> {
    this.unsubscribe = [
      this.lan.onOpen(({ id, inbound }) => {
        if (inbound) this.guests.add(id);
      }),
      this.lan.onLine(({ id, line }) => {
        if (!this.guests.has(id)) return;
        const message = this.codec.decode(line);
        if (message === null) this.lan.close(id);
        else this.onMessage(message);
      }),
      this.lan.onClose(({ id }) => {
        this.guests.delete(id);
      }),
    ];
    this.lan.advertise(serviceName(this.sessionId));
    this.port = await this.lan.listen(0);
    return true;
  }

  /**
   * Where guests can reach this phone, as `ip:port`: read again each time, since the Wi-Fi can
   * come and go and a hotspot can be turned on during the match. Empty: no Wi-Fi at all.
   */
  endpoints(): string[] {
    if (this.port === 0) return [];
    return this.lan.addresses().map((ip) => `${ip}:${this.port}`);
  }

  broadcast(message: Out) {
    if (this.guests.size === 0) return;
    const line = this.codec.encode(message);
    for (const id of this.guests) this.lan.send(id, line);
  }

  stop() {
    for (const off of this.unsubscribe) off();
    this.unsubscribe = [];
    for (const id of this.guests) this.lan.close(id);
    this.guests.clear();
    this.lan.stopAdvertising();
    this.lan.stopListening();
    this.port = 0;
  }
}
