import { requireNativeModule } from 'expo';

type AudioEnvelopeModule = {
  /**
   * Loudness of a video's sound: one RMS value (0..1) per window of `windowMs`, from the start of
   * the file. Empty when the file has no sound track.
   */
  read(path: string, windowMs: number): Promise<number[]>;
};

export default requireNativeModule<AudioEnvelopeModule>('AudioEnvelope');
