import { getRandomBytes } from 'expo-crypto';

/** Cryptographically secure random bytes, from the platform (expo-crypto). */
export const randomBytes = (count: number): Uint8Array => getRandomBytes(count);
