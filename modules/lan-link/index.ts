import { type NativeModule, requireNativeModule } from 'expo';

type LanLinkEvents = {
  /** A connection is up: one a guest opened to this phone (`inbound`), or one `connect` opened. */
  onOpen(event: { id: string; inbound: boolean }): void;
  /** One line received, without its newline. */
  onLine(event: { id: string; line: string }): void;
  /** The connection is gone: closed by either side, or broken. Sent once per connection. */
  onClose(event: { id: string }): void;
};

/**
 * Text lines over TCP on the local network (Wi-Fi, or a phone's personal hotspot): the host
 * listens, the guests connect. No internet, no server, no discovery: the address travels in the
 * QR code and over Bluetooth.
 */
declare class LanLinkModule extends NativeModule<LanLinkEvents> {
  /** Listens on every interface; 0 picks a free port. Resolves with the port. */
  listen(port: number): Promise<number>;
  stopListening(): void;
  /** This phone's private IPv4 addresses on Wi-Fi and hotspot interfaces (not cellular). */
  addresses(): string[];
  /**
   * mDNS: announces this phone's listener under a name (`_lineo._tcp`), from the next `listen`
   * on, or the current one.
   */
  advertise(name: string): void;
  stopAdvertising(): void;
  /** Resolves with the connection's id once it is up; rejects after a few seconds otherwise. */
  connect(host: string, port: number): Promise<string>;
  /** Same, to the phone that advertises this mDNS name: no address needed. */
  connectService(name: string): Promise<string>;
  /** Sends one line; the newline is added. */
  send(id: string, line: string): void;
  close(id: string): void;
  /**
   * Android: sends this app's traffic through the Wi-Fi even when it has no internet (the phone
   * would otherwise use mobile data and never reach the host). iOS has nothing to do: true.
   */
  bindToWifi(): Promise<boolean>;
  unbindWifi(): void;
}

export default requireNativeModule<LanLinkModule>('LanLink');
