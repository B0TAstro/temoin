import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { bytesToUtf8, concatBytes, utf8ToBytes } from '@noble/ciphers/utils.js';

import { fromBase64Url, toBase64Url } from './base64url';
import type { Codec } from './codec';

/** Session key: 32 random bytes, carried by the QR code only, never sent over the radio. */
export const KEY_BYTES = 32;
const NONCE_BYTES = 24;
const TAG_BYTES = 16;

/**
 * Every message of a session, encrypted and signed with the session key (XChaCha20-Poly1305):
 * without the QR code, a phone in range can neither read the score nor change it.
 *
 * A message is sealed once, with a fresh random nonce. A copy of a message already received (an
 * attacker sending back what it recorded, an "Annuler le point" for instance) carries the same
 * nonce, and is dropped.
 */
export class SealedCodec<In, Out> implements Codec<In, Out> {
  private readonly seen = new Set<string>();

  constructor(
    private readonly key: Uint8Array,
    /** Cryptographically secure random bytes, from the platform. */
    private readonly randomBytes: (count: number) => Uint8Array,
  ) {}

  encode(message: Out): string {
    const nonce = this.randomBytes(NONCE_BYTES);
    const sealed = xchacha20poly1305(this.key, nonce).encrypt(utf8ToBytes(JSON.stringify(message)));
    return toBase64Url(concatBytes(nonce, sealed));
  }

  decode(line: string): In | null {
    const bytes = fromBase64Url(line);
    if (!bytes || bytes.length < NONCE_BYTES + TAG_BYTES) return null;
    const nonce = bytes.subarray(0, NONCE_BYTES);
    const id = toBase64Url(nonce);
    if (this.seen.has(id)) return null;
    try {
      const plain = xchacha20poly1305(this.key, nonce).decrypt(bytes.subarray(NONCE_BYTES));
      // Only a genuine message is remembered: garbage cannot fill the set.
      this.seen.add(id);
      return JSON.parse(bytesToUtf8(plain)) as In;
    } catch {
      return null; // wrong key, or tampered with
    }
  }
}
