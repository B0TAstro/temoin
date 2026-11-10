import { requireNativeModule } from 'expo';

type SoundLevelsModule = {
  read(path: string, windowMs: number): Promise<number[]>;
};

export default requireNativeModule<SoundLevelsModule>('SoundLevels');
