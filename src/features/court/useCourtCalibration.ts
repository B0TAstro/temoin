import { useState, useSyncExternalStore } from 'react';

import { type CalibrationState, CourtCalibration } from './CourtCalibration';

/** The match's court calibration: the object keeps it, this wires it to React */
export function useCourtCalibration(): CalibrationState & Pick<CourtCalibration, 'set' | 'clear'> {
  const [calibration] = useState(() => new CourtCalibration());
  const state = useSyncExternalStore(calibration.store.subscribe, calibration.store.get);
  return { ...state, set: calibration.set, clear: calibration.clear };
}
