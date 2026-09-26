// LISA simulation — wavelength calibration of the simulated sensor.
// True line positions come from the twin's grating geometry; the operator's peak
// picks are perturbed (noise, shift, a missing line) and fed to the production
// fitWavelengthCalibration(). Error is measured against the true geometry.

import { fitWavelengthCalibration, CFL_REFERENCE_LINES } from '../engine/wavelength';
import { SeededPRNG } from '../engine/prng';
import { pixelOfWavelength, SENSOR_COLUMNS, SENSOR_X_MIN, SENSOR_X_MAX, wavelengthAtSensorX } from '../digitalTwin/twinModel';

export interface WavecalOptions {
  pixelNoise: number; // σ of peak-pick error, px
  shiftPx: number; // spectrum moved on the sensor AFTER calibration (phone re-seated), px
  dropLine: string | null; // reference line not found
  seed: string;
}

const trueNmAtPixel = (p: number) =>
  wavelengthAtSensorX(SENSOR_X_MIN + (p / (SENSOR_COLUMNS - 1)) * (SENSOR_X_MAX - SENSOR_X_MIN));

export function simulateWavelengthCalibration(o: WavecalOptions) {
  const prng = new SeededPRNG(o.seed);
  const picks = CFL_REFERENCE_LINES.filter((l) => l.name !== o.dropLine).map((l) => ({
    lineName: l.name,
    truePixel: pixelOfWavelength(l.trueNm),
    pixel: pixelOfWavelength(l.trueNm) + prng.gaussian(0, o.pixelNoise),
  }));
  const fit = fitWavelengthCalibration(picks, SENSOR_COLUMNS);
  // Worst wavelength error of the fitted map over 400–700 nm, against where light
  // actually lands now (true geometry moved by shiftPx).
  let maxErrNm = 0;
  if (fit.isValid) {
    for (let nm = 400; nm <= 700; nm += 5) {
      const p = pixelOfWavelength(nm) + o.shiftPx;
      maxErrNm = Math.max(maxErrNm, Math.abs(fit.slope * p + fit.intercept - trueNmAtPixel(p - o.shiftPx)));
    }
  }
  return { picks, fit, maxErrNm: fit.isValid ? maxErrNm : null, nmPerPixel: fit.isValid ? fit.slope : null };
}
