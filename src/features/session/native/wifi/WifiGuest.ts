import type { Codec } from '../../logic/codec';
import { type LanLink, serviceName } from '../lanLink';
import type { GuestTransport, LinkStatus } from '../Transport';

const RETRY_MS = 2000;

/**
 * A guest on the local Wi-Fi: connects to the first of the host's addresses that answers, and
 * tries them all again when the connection drops. The addresses come from the QR code, then from
 * the host's pings (a hotspot turned on during the match). With none of them (a guest that typed
 * the phrase, out of Bluetooth range), it finds the host by its mDNS name. On iOS the first
 * connection waits for the local network permission: it fails while the prompt is up, the next
 * try gets through.
 */
export class WifiGuest<In, Out> implements GuestTransport<Out> {
  private endpoints: string[] = [];
  private connection: string | undefined;
  private unsubscribe: (() => void)[] = [];
  private stopped = false;
  private trying = false;
  private retry: ReturnType<typeof setTimeout> | undefined;
  /** Android: the app is routed through the Wi-Fi (asked again before each try until it is). */
  private bound = false;

  constructor(
    private readonly sessionId: string,
    private readonly lan: LanLink,
    private readonly codec: Codec<In, Out>,
    private readonly onMessage: (message: In) => void,
    private readonly onStatus: (status: LinkStatus) => void,
    /** Called once connected, to ask for the whole log. */
    private readonly onConnected: () => void,
  ) {}

  async start(): Promise<boolean> {
    this.stopped = false;
    this.unsubscribe = [
      this.lan.onLine(({ id, line }) => {
        if (id !== this.connection) return;
        const message = this.codec.decode(line);
        if (message !== null) this.onMessage(message);
      }),
      this.lan.onClose(({ id }) => {
        if (id !== this.connection) return;
        this.connection = undefined;
        this.lost();
      }),
    ];
    void this.tryEndpoints();
    return true;
  }

  /** The host's addresses: new ones are tried when the link is down. */
  setEndpoints(endpoints: readonly string[]) {
    if (endpoints.join() === this.endpoints.join()) return;
    this.endpoints = [...endpoints];
    if (this.connection === undefined) void this.tryEndpoints();
  }

  /**
   * The host's pings stopped coming while the socket still looks open (the Wi-Fi went away without
   * a word): drop it and try the addresses again.
   */
  reconnect() {
    if (this.connection === undefined) return;
    this.lan.close(this.connection);
    this.connection = undefined;
    this.lost();
  }

  send(message: Out) {
    if (this.connection !== undefined) this.lan.send(this.connection, this.codec.encode(message));
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.retry);
    for (const off of this.unsubscribe) off();
    this.unsubscribe = [];
    if (this.connection !== undefined) this.lan.close(this.connection);
    this.connection = undefined;
    this.bound = false;
    this.lan.unbindWifi();
  }

  private async tryEndpoints() {
    // Already connected: a second socket would replace the first and leave it open
    const busy = this.trying || this.connection !== undefined;
    if (this.stopped || busy) return;
    this.trying = true;
    clearTimeout(this.retry);
    this.onStatus('connecting');
    // Android: a Wi-Fi with no internet would otherwise lose to mobile data. Android gives up the
    // request after a few seconds: asked again on every try until it holds
    if (!this.bound) this.bound = await this.lan.bindToWifi().catch(() => false);
    const attempts = [
      ...this.endpoints.map((endpoint) => () => {
        const [host, port] = endpoint.split(':');
        return this.lan.connect(host ?? '', Number(port));
      }),
      // Last: the host's mDNS name, for a guest that knows no address
      () => this.lan.connectService(serviceName(this.sessionId)),
    ];
    for (const attempt of attempts) {
      if (this.stopped) break;
      try {
        const id = await attempt();
        if (this.stopped) {
          this.lan.close(id);
          break;
        }
        this.connection = id;
        this.trying = false;
        this.onStatus('connected');
        this.onConnected();
        return;
      } catch {
        // next one
      }
    }
    this.trying = false;
    this.lost();
  }

  private lost() {
    if (this.stopped) return;
    this.onStatus('lost');
    clearTimeout(this.retry);
    this.retry = setTimeout(() => void this.tryEndpoints(), RETRY_MS);
  }
}
