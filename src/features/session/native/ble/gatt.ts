/**
 * What Témoin looks like over Bluetooth. These UUIDs are the contract between phones, like
 * PROTOCOL_VERSION: every phone, iPhone or Android, must use the same ones. They are not secret:
 * any scan shows them (the last group spells "temoin" in hex).
 */

/** Témoin's GATT service: one characteristic per direction. */
export const SERVICE = '6b1c0001-6f74-4e1d-9a0b-74656d6f696e';
/** Guests write their messages here. */
export const TO_HOST = '6b1c0002-6f74-4e1d-9a0b-74656d6f696e';
/** The host notifies every guest here. */
export const TO_GUESTS = '6b1c0003-6f74-4e1d-9a0b-74656d6f696e';

/** UUIDs compare without case: the platforms do not report them the same way. */
export const sameUuid = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** What the host advertises, so a guest finds the session it scanned. */
export const advertisedName = (sessionId: string) => `T-${sessionId}`;
