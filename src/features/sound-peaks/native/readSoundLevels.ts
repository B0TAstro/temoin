import SoundLevels from '../../../../modules/sound-levels';

/** Loudness of a clip's sound, one RMS value per window. Empty when the clip has no sound. */
export function readSoundLevels(path: string, windowMs: number): Promise<number[]> {
  return SoundLevels.read(path, windowMs);
}
