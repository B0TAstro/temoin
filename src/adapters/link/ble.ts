import {
  addEventListener,
  connect,
  disconnect,
  discoverServices,
  requestBluetoothPermission,
  requestMTU,
  setServices,
  startAdvertising,
  startScan,
  stopAdvertising,
  stopScan,
  subscribeToCharacteristic,
  updateCharacteristicValue,
  writeCharacteristic,
} from 'munim-bluetooth';
import { Platform } from 'react-native';

import { Decoder, encode } from './ble/framing';

/** Témoin's GATT service: one characteristic per direction. */
const SERVICE = '6b1c0001-6f74-4e1d-9a0b-74656d6f696e';
/** Guests write their messages here. */
const TO_HOST = '6b1c0002-6f74-4e1d-9a0b-74656d6f696e';
/** The host notifies every guest here. */
const TO_GUESTS = '6b1c0003-6f74-4e1d-9a0b-74656d6f696e';
const RETRY_MS = 2000;

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
/** What the host advertises, so a guest finds the session it scanned. */
export const advertisedName = (sessionId: string) => `T-${sessionId}`;

export type LinkStatus = 'searching' | 'connecting' | 'connected' | 'lost';

/** Sends packets one after the other: BLE keeps them in order only if we wait for each. */
class SerialSender {
  private chain: Promise<unknown> = Promise.resolve();

  send(chunks: string[], write: (chunk: string) => Promise<void>) {
    for (const chunk of chunks) {
      this.chain = this.chain.then(() => write(chunk)).catch((e) => console.warn('BLE send', e));
    }
  }
}

/**
 * The host phone: a BLE peripheral. Advertises the session, receives the guests' messages and
 * notifies every subscribed guest. Notifications go to all guests at once.
 */
export class BleHost<In, Out> {
  private readonly decoders = new Map<string, Decoder<In>>();
  private readonly guests = new Set<string>();
  private readonly sender = new SerialSender();
  private unsubscribe: (() => void)[] = [];

  constructor(
    private readonly sessionId: string,
    private readonly onMessage: (message: In) => void,
    private readonly onGuests: (count: number) => void,
  ) {}

  async start(): Promise<boolean> {
    const allowed = await requestBluetoothPermission(['advertise', 'connect']);
    if (!allowed) return false;

    this.unsubscribe = [
      addEventListener('peripheralWriteRequest', (request) => {
        if (!same(request.characteristicUUID, TO_HOST)) return;
        let decoder = this.decoders.get(request.centralId);
        if (!decoder) {
          decoder = new Decoder<In>();
          this.decoders.set(request.centralId, decoder);
        }
        for (const message of decoder.push(request.value)) this.onMessage(message);
      }),
      addEventListener('peripheralSubscribed', ({ centralId }) => {
        this.guests.add(centralId);
        this.onGuests(this.guests.size);
      }),
      addEventListener('peripheralUnsubscribed', ({ centralId }) => {
        this.guests.delete(centralId);
        this.decoders.delete(centralId);
        this.onGuests(this.guests.size);
      }),
    ];

    setServices(
      [
        {
          uuid: SERVICE,
          characteristics: [
            { uuid: TO_HOST, properties: ['write'] },
            { uuid: TO_GUESTS, properties: ['read', 'notify'] },
          ],
        },
      ],
      { mode: 'automatic' },
    );
    startAdvertising({ serviceUUIDs: [SERVICE], localName: advertisedName(this.sessionId) });
    return true;
  }

  send(message: Out) {
    this.sender.send(encode(message), (chunk) =>
      updateCharacteristicValue(SERVICE, TO_GUESTS, chunk, true),
    );
  }

  stop() {
    stopAdvertising();
    for (const off of this.unsubscribe) off();
    this.unsubscribe = [];
  }
}

/**
 * A guest phone: a BLE central. Finds the host by the name in the QR code, subscribes to its
 * notifications and writes its own messages. Reconnects on its own when the link drops.
 */
export class BleGuest<In, Out> {
  private deviceId: string | undefined;
  private decoder = new Decoder<In>();
  private readonly sender = new SerialSender();
  private unsubscribe: (() => void)[] = [];
  private stopped = false;
  private retry: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly sessionId: string,
    private readonly onMessage: (message: In) => void,
    private readonly onStatus: (status: LinkStatus) => void,
    /** Called once connected and subscribed, to ask for the whole log. */
    private readonly onConnected: () => void,
  ) {}

  async start(): Promise<boolean> {
    const allowed = await requestBluetoothPermission(['scan', 'connect']);
    if (!allowed) return false;

    this.unsubscribe = [
      addEventListener('deviceFound', (device) => {
        if (this.deviceId != null) return;
        const name = device.localName ?? device.name;
        if (name !== advertisedName(this.sessionId)) return;
        this.deviceId = device.id;
        stopScan();
        void this.open(device.id);
      }),
      addEventListener('characteristicValueChanged', (change) => {
        if (change.deviceId !== this.deviceId || !same(change.characteristicUUID, TO_GUESTS))
          return;
        for (const message of this.decoder.push(change.value)) this.onMessage(message);
      }),
      addEventListener('deviceDisconnected', ({ deviceId }) => {
        if (deviceId !== this.deviceId) return;
        this.lost();
      }),
    ];
    this.search();
    return true;
  }

  send(message: Out) {
    const deviceId = this.deviceId;
    if (deviceId == null) return;
    this.sender.send(encode(message), (chunk) =>
      writeCharacteristic(deviceId, SERVICE, TO_HOST, chunk, 'write'),
    );
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.retry);
    stopScan();
    if (this.deviceId != null) disconnect(this.deviceId);
    for (const off of this.unsubscribe) off();
    this.unsubscribe = [];
  }

  private search() {
    if (this.stopped) return;
    this.deviceId = undefined;
    this.decoder = new Decoder<In>();
    this.onStatus('searching');
    startScan({ serviceUUIDs: [SERVICE] });
  }

  private async open(deviceId: string) {
    this.onStatus('connecting');
    try {
      await connect(deviceId, { timeoutMs: 10_000 });
      // Android starts at 20 bytes per packet; iOS negotiates on its own.
      if (Platform.OS === 'android') await requestMTU(deviceId, 517).catch(() => 0);
      await discoverServices(deviceId);
      await subscribeToCharacteristic(deviceId, SERVICE, TO_GUESTS);
      this.onStatus('connected');
      this.onConnected();
    } catch (e) {
      console.warn('BLE connect', e);
      this.lost();
    }
  }

  private lost() {
    if (this.stopped) return;
    this.onStatus('lost');
    clearTimeout(this.retry);
    this.retry = setTimeout(() => this.search(), RETRY_MS);
  }
}
