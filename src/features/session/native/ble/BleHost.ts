import {
  addEventListener,
  requestBluetoothPermission,
  setServices,
  startAdvertising,
  stopAdvertising,
  updateCharacteristicValue,
} from 'munim-bluetooth';

import type { Codec } from '../../logic/codec';

import { encodeLine, LineDecoder } from './framing';
import { advertisedName, sameUuid, SERVICE, TO_GUESTS, TO_HOST } from './gatt';
import { SerialSender } from './SerialSender';
import type { HostTransport } from '../Transport';

/**
 * The host phone: a BLE peripheral. Advertises the session, receives the guests' messages and
 * notifies every subscribed guest. Notifications go to all guests at once.
 */
export class BleHost<In, Out> implements HostTransport<Out> {
  private readonly decoders = new Map<string, LineDecoder>();
  private readonly guests = new Set<string>();
  private readonly sender = new SerialSender();
  private unsubscribe: (() => void)[] = [];

  constructor(
    private readonly sessionId: string,
    private readonly codec: Codec<In, Out>,
    private readonly onMessage: (message: In) => void,
    private readonly onGuests: (count: number) => void,
  ) {}

  async start(): Promise<boolean> {
    const allowed = await requestBluetoothPermission(['advertise', 'connect']);
    if (!allowed) return false;

    this.unsubscribe = [
      addEventListener('peripheralWriteRequest', (request) => {
        if (!sameUuid(request.characteristicUUID, TO_HOST)) return;
        let decoder = this.decoders.get(request.centralId);
        if (!decoder) {
          decoder = new LineDecoder();
          this.decoders.set(request.centralId, decoder);
        }
        for (const line of decoder.push(request.value)) {
          const message = this.codec.decode(line);
          if (message !== null) this.onMessage(message);
        }
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

  broadcast(message: Out) {
    this.sender.send(encodeLine(this.codec.encode(message)), (chunk) =>
      updateCharacteristicValue(SERVICE, TO_GUESTS, chunk, true),
    );
  }

  stop() {
    stopAdvertising();
    for (const off of this.unsubscribe) off();
    this.unsubscribe = [];
  }
}
