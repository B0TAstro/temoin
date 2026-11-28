import { Store } from '@/shared/lib/Store';
import type { SetupForm } from '@/sports/tennis';

import { chooseLink } from './logic/chooseLink';
import type { Codec } from './logic/codec';
import { receiveEvent, receiveSnapshot } from './logic/guestLog';
import { isLocalEndpoint } from './logic/joinLink';
import { type LinkHealth, linkHealth } from './logic/linkHealth';
import type { LoggedEvent, MatchEvent } from './logic/matchLog';
import type { GuestMessage, HostMessage } from './logic/messages';
import type { GuestTransport, LinkKind, LinkStatus } from './native/Transport';
import type { WifiGuest } from './native/wifi/WifiGuest';
import { completeForm } from './setup';

type In = HostMessage<SetupForm>;
type GuestCodec = Codec<In, GuestMessage>;
type Callbacks = {
  onMessage: (message: In) => void;
  onStatus: (status: LinkStatus) => void;
  onConnected: () => void;
};

/** How often the links are judged again. */
const JUDGE_EVERY_MS = 500;

/** The guest's links, built when the session starts: injected, so the session runs without radios. */
export type CreateGuestLinks = {
  codec: () => GuestCodec;
  bluetooth: (codec: GuestCodec, callbacks: Callbacks) => GuestTransport<GuestMessage>;
  wifi: (
    codec: GuestCodec,
    callbacks: Callbacks,
  ) => Pick<WifiGuest<In, GuestMessage>, 'start' | 'send' | 'stop' | 'setEndpoints' | 'reconnect'>;
};

export type GuestState = {
  form: SetupForm | undefined;
  log: readonly LoggedEvent[];
  /** The link the guest sends on; undefined: none works. */
  via: LinkKind | undefined;
  /** Each link, as the host's pings say (undefined: no ping by it yet). */
  health: Partial<Record<LinkKind, LinkHealth>>;
  /** Each link's connection, as its transport says. */
  status: Record<LinkKind, LinkStatus | undefined>;
  /** Whether the host has a Wi-Fi address to try. */
  wifiKnown: boolean;
};

/**
 * A guest mirrors the host's log. Its actions go to the host as intents and only count once the
 * host sends them back as events; a missing event triggers a full resync.
 *
 * It keeps Bluetooth and, once it knows the host's address, the Wi-Fi open side by side, takes
 * messages from both (an event or a log already received is ignored), and sends on **one** link
 * only, chosen from the host's pings: an intent is never sent twice, since an undo sent twice
 * would undo two points. On every change of link it asks for the whole log, which brings back
 * anything lost on the way.
 */
export class SessionGuest {
  readonly store = new Store<GuestState>({
    form: undefined,
    log: [],
    via: undefined,
    health: {},
    status: { bluetooth: 'searching', wifi: undefined },
    wifiKnown: false,
  });
  private links: Partial<Record<LinkKind, GuestTransport<GuestMessage>>> = {};
  private wifi: ReturnType<CreateGuestLinks['wifi']> | undefined;
  private codec: GuestCodec | undefined;
  private lastPing: Partial<Record<LinkKind, number>> = {};
  private bluetoothOkSince: number | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(
    /** This phone, in its pongs: the host counts guests by it. */
    private readonly device: string,
    /** The host's Wi-Fi addresses from the QR code, if it had any. */
    private readonly wifiHint: readonly string[],
    private readonly create: CreateGuestLinks,
  ) {}

  start() {
    if (this.running) return;
    this.running = true;
    const codec = this.create.codec();
    this.codec = codec;

    const bluetooth = this.create.bluetooth(codec, this.callbacks('bluetooth'));
    this.links.bluetooth = bluetooth;
    bluetooth.start().catch((e) => {
      console.warn('BLE guest', e);
      this.setStatus('bluetooth', 'lost');
    });
    // From the start, even with no address: the host may be found by its mDNS name
    this.openWifi(this.wifiHint);
    this.timer = setInterval(() => this.judge(), JUDGE_EVERY_MS);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    clearInterval(this.timer);
    for (const link of Object.values(this.links)) link.stop();
    this.links = {};
    this.wifi = undefined;
    this.lastPing = {};
  }

  /** The guest's actions: to the host, on the link in use. */
  readonly dispatch = (event: MatchEvent) => {
    this.send({ t: 'intent', event });
  };

  private callbacks(kind: LinkKind): Callbacks {
    return {
      onMessage: (message) => this.receive(message, kind),
      onStatus: (status) => this.setStatus(kind, status),
      // Just connected: the whole log, by this link
      onConnected: () => this.links[kind]?.send({ t: 'sync' }),
    };
  }

  private openWifi(endpoints: readonly string[]) {
    if (!this.codec) return;
    if (!this.wifi) {
      const wifi = this.create.wifi(this.codec, this.callbacks('wifi'));
      this.wifi = wifi;
      this.links.wifi = wifi;
      wifi.start().catch((e) => console.warn('Wi-Fi guest', e));
    }
    if (endpoints.length > 0) this.store.set({ wifiKnown: true });
    this.wifi.setEndpoints(endpoints);
  }

  private receive(message: In, kind: LinkKind) {
    const state = this.store.get();
    if (message.t === 'ping') {
      this.lastPing[kind] = Date.now();
      this.links[kind]?.send({ t: 'pong', n: message.n, device: this.device });
      const wifi = message.wifi.filter(isLocalEndpoint);
      if (wifi.length > 0) this.openWifi(wifi);
      return;
    }
    if (message.t === 'snapshot') {
      this.store.set({
        form: completeForm(message.setup),
        log: receiveSnapshot(state.log, message.log),
      });
    } else if (message.t === 'event') {
      const received = receiveEvent(state.log, message.event);
      if (received.gap) this.links[kind]?.send({ t: 'sync' });
      this.store.set({ log: received.log });
    }
    // anything else is not a host message: ignored
  }

  /** Judges both links, and moves to another one when it should. */
  private judge() {
    const now = Date.now();
    const bluetooth = linkHealth(this.lastPing.bluetooth, now);
    const wifi = linkHealth(this.lastPing.wifi, now);
    if (bluetooth !== 'ok') this.bluetoothOkSince = undefined;
    else this.bluetoothOkSince ??= now;

    const state = this.store.get();
    const via = chooseLink({
      current: state.via,
      bluetooth,
      wifi,
      bluetoothOkForMs: this.bluetoothOkSince === undefined ? 0 : now - this.bluetoothOkSince,
    });
    // The Wi-Fi went silent with its socket still open: drop it and try the addresses again
    if (wifi === 'lost' && state.health.wifi !== 'lost') this.wifi?.reconnect();
    if (bluetooth !== state.health.bluetooth || wifi !== state.health.wifi) {
      this.store.set({ health: { ...(bluetooth && { bluetooth }), ...(wifi && { wifi }) } });
    }
    if (via !== state.via) {
      this.store.set({ via });
      // A new link: catch up on whatever the old one lost
      if (via) this.links[via]?.send({ t: 'sync' });
    }
  }

  /** On the link in use; before the first ping, on any link that is connected. */
  private send(message: GuestMessage) {
    const { via, status } = this.store.get();
    const kind =
      via ??
      (status.bluetooth === 'connected'
        ? 'bluetooth'
        : status.wifi === 'connected'
          ? 'wifi'
          : undefined);
    if (kind) this.links[kind]?.send(message);
  }

  private setStatus(kind: LinkKind, status: LinkStatus) {
    this.store.set({ status: { ...this.store.get().status, [kind]: status } });
  }
}
