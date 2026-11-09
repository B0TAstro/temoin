import {
  addEventListener,
  connect,
  disconnect,
  discoverServices,
  requestBluetoothPermission,
  requestMTU,
  startScan,
  stopScan,
  subscribeToCharacteristic,
  writeCharacteristic,
} from 'munim-bluetooth';
import { Platform } from 'react-native';

import { Decoder, encode } from './framing';
import { advertisedName, sameUuid, SERVICE, TO_GUESTS, TO_HOST } from './gatt';
import { SerialSender } from './SerialSender';
import type { GuestTransport, LinkStatus } from '../Transport';

const RETRY_MS = 2000;

/**
 * A guest phone: a BLE central. Finds the host by the name in the QR code, subscribes to its
 * notifications and writes its own messages. Reconnects on its own when the link drops.
 */
export class BleGuest<In, Out> implements GuestTransport<Out> {
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
        if (change.deviceId !== this.deviceId || !sameUuid(change.characteristicUUID, TO_GUESTS))
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
