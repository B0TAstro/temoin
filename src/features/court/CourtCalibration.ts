import { Store } from '@/shared/lib/Store';

import { type Calibration, courtGeometry, type CourtGeometry } from './logic/courtGeometry';

export type CalibrationState = {
  calibration: Calibration | undefined;
  /** The court over the picture, worked out once from the calibration */
  geometry: CourtGeometry | undefined;
};

const NONE: CalibrationState = { calibration: undefined, geometry: undefined };

/**
 * The court as this phone films it, placed by the player on the camera image. In memory for the
 * match only, on this phone only: each phone has its own angle, so it is neither in the log nor in
 * the settings. Cleared when the camera changes, since the picture does
 */
export class CourtCalibration {
  readonly store = new Store<CalibrationState>(NONE);

  /** False when the 4 points make no court (3 of them in line) */
  readonly set = (calibration: Calibration): boolean => {
    const geometry = courtGeometry(calibration);
    if (!geometry) return false;
    this.store.set({ calibration, geometry });
    return true;
  };

  readonly clear = () => this.store.set(NONE);
}
