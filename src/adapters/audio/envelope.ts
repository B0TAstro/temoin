import AudioEnvelope from '../../../modules/audio-envelope';

/** Loudness of a clip's sound, one RMS value per window. Empty when the clip has no sound. */
export function readEnvelope(path: string, windowMs: number): Promise<number[]> {
  return AudioEnvelope.read(path, windowMs);
}
