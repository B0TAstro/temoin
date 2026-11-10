/**
 * Turns a message into one line of plain ASCII (no newline) and back. The transport carries
 * lines and never looks inside them.
 */
export interface Codec<In, Out> {
  encode(message: Out): string;
  /** Null when the line must be dropped (not from this session, tampered with, replayed). */
  decode(line: string): In | null;
}
