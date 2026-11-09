import {
  addEventListener,
  requestBluetoothPermission,
  setServices,
  startAdvertising,
  stopAdvertising,
  updateCharacteristicValue,
} from 'munim-bluetooth';

import { Decoder, encode } from './framing';
import { advertisedName, sameUuid, SERVICE, TO_GUESTS, TO_HOST } from './gatt';
import { SerialSender } from './SerialSender';

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
        if (!sameUuid(request.characteristicUUID, TO_HOST)) return;
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
