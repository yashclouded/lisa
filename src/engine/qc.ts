// LISA: Multi-Tier Quality Control (QC) Engine
// Evaluates saturation, signal strength, optical drift, calibration range, and matrix turbidity

import { QCReport, QCStatus } from '../types';

export function runQualityControl(
  rawIntensities: number[],
  absorbances: number[],
  predictedConc: number,
  shiftPx: number,
  calibrationRange: [number, number] = [0.0, 1.0],
  lod: number = 0.05,
  unit: string = 'mg/L'
): QCReport {
  // 1. Saturation Check (Camera sensor clipping >= 250 on 8-bit scale)
  const maxIntensity = Math.max(...rawIntensities);
  let satStatus: QCStatus = 'PASS';
  let satDetail = `Peak intensity ${maxIntensity.toFixed(0)} within linear sensor response (target 100-240).`;

  if (maxIntensity >= 250) {
    satStatus = 'FAIL';
    satDetail = `Sensor pixel saturation detected (Max ${maxIntensity.toFixed(0)} ≥ 250). Reduce camera exposure compensation.`;
  } else if (maxIntensity > 235) {
    satStatus = 'WARNING';
    satDetail = `High intensity (Max ${maxIntensity.toFixed(0)}). Approaching sensor saturation ceiling.`;
  }

  // 2. Low Signal Check (Insufficient light transmission)
  let sigStatus: QCStatus = 'PASS';
  let sigDetail = `Optical throughput adequate (Peak ${maxIntensity.toFixed(0)} > 40).`;

  if (maxIntensity < 30) {
    sigStatus = 'FAIL';
    sigDetail = `Critical low optical throughput (Peak ${maxIntensity.toFixed(0)} < 30). Verify illumination LED alignment.`;
  } else if (maxIntensity < 50) {
    sigStatus = 'WARNING';
    sigDetail = `Marginal light level (Peak ${maxIntensity.toFixed(0)} < 50). SNR may be degraded.`;
  }

  // 3. Spectral Shift Check
  let shiftStatus: QCStatus = 'PASS';
  let shiftDetail = `Optical insertion shift ${shiftPx > 0 ? '+' : ''}${shiftPx}px within mechanical tolerance (≤ ±6px).`;

  if (Math.abs(shiftPx) > 6) {
    shiftStatus = 'FAIL';
    shiftDetail = `Excessive cuvette displacement (${shiftPx > 0 ? '+' : ''}${shiftPx}px > ±6px). Re-seat cuvette in chamber.`;
  } else if (Math.abs(shiftPx) > 3) {
    shiftStatus = 'WARNING';
    shiftDetail = `Moderate optical shift (${shiftPx > 0 ? '+' : ''}${shiftPx}px). Corrected via cross-correlation.`;
  }

  // 4. Calibration Range Check
  let rangeStatus: QCStatus = 'PASS';
  let rangeDetail = `Concentration ${predictedConc.toFixed(2)} ${unit} within validated range (${calibrationRange[0]}–${calibrationRange[1]} ${unit}).`;

  if (predictedConc > calibrationRange[1] * 1.15) {
    rangeStatus = 'FAIL';
    rangeDetail = `Concentration ${predictedConc.toFixed(2)} ${unit} exceeds highest standard (${calibrationRange[1].toFixed(2)} ${unit}). Sample above range: Dilute 1:10.`;
  } else if (predictedConc < lod) {
    rangeStatus = 'WARNING';
    rangeDetail = `Concentration below Limit of Detection (< ${lod.toFixed(2)} ${unit}). Reported as trace/clean.`;
  }

  // 5. Turbidity / Matrix Interference Check (Elevated non-specific baseline in 400-450 nm region)
  const blueBandAbsorbance = absorbances.slice(0, 25);
  const avgBlueAbs = blueBandAbsorbance.reduce((a, b) => a + b, 0) / (blueBandAbsorbance.length || 1);
  let turbStatus: QCStatus = 'PASS';
  let turbDetail = `Matrix background absorbance (${avgBlueAbs.toFixed(3)} AU at 400-450nm) within clean threshold (≤ 0.12 AU).`;

  if (avgBlueAbs > 0.25) {
    turbStatus = 'WARNING';
    turbDetail = `Significant matrix turbidity or organic color detected (Baseline ${avgBlueAbs.toFixed(3)} AU). Perform sample blank.`;
  } else if (avgBlueAbs > 0.12) {
    turbStatus = 'WARNING';
    turbDetail = `Slight non-specific background absorbance (${avgBlueAbs.toFixed(3)} AU). Syringe filtration recommended.`;
  }

  // Overall QC evaluation
  const hasFail = satStatus === 'FAIL' || sigStatus === 'FAIL' || shiftStatus === 'FAIL' || rangeStatus === 'FAIL';
  const hasWarning = satStatus === 'WARNING' || sigStatus === 'WARNING' || shiftStatus === 'WARNING' || rangeStatus === 'WARNING' || turbStatus === 'WARNING';

  const overallStatus: QCStatus = hasFail ? 'FAIL' : hasWarning ? 'WARNING' : 'PASS';
  const canProceed = !hasFail;

  let rejectionReason: string | undefined = undefined;
  if (satStatus === 'FAIL') rejectionReason = 'Sensor pixel saturation detected. Optical measurement clipped.';
  else if (sigStatus === 'FAIL') rejectionReason = 'Optical transmission too dark to resolve chromophore spectrum.';
  else if (shiftStatus === 'FAIL') rejectionReason = 'Cuvette mechanically displaced beyond registration tolerance.';
  else if (rangeStatus === 'FAIL') rejectionReason = 'Sample exceeds validated dynamic range (Dilution 1:10 required).';

  return {
    overallStatus,
    saturationCheck: {
      id: 'saturation',
      name: 'Pixel Saturation',
      status: satStatus,
      value: `${maxIntensity.toFixed(0)} / 255`,
      threshold: '< 245',
      detail: satDetail,
    },
    signalStrengthCheck: {
      id: 'signal',
      name: 'Signal Throughput',
      status: sigStatus,
      value: `${maxIntensity.toFixed(0)} AU`,
      threshold: '> 40',
      detail: sigDetail,
    },
    spectralShiftCheck: {
      id: 'shift',
      name: 'Optical Alignment',
      status: shiftStatus,
      value: `${shiftPx > 0 ? '+' : ''}${shiftPx} px`,
      threshold: '≤ ±6 px',
      detail: shiftDetail,
    },
    calibrationRangeCheck: {
      id: 'range',
      name: 'Dynamic Range',
      status: rangeStatus,
      value: `${predictedConc.toFixed(2)} ${unit}`,
      threshold: `${calibrationRange[0]} – ${calibrationRange[1]} ${unit}`,
      detail: rangeDetail,
    },
    turbidityInterferenceCheck: {
      id: 'turbidity',
      name: 'Matrix Turbidity',
      status: turbStatus,
      value: `${avgBlueAbs.toFixed(3)} AU`,
      threshold: '≤ 0.12 AU',
      detail: turbDetail,
    },
    canProceed,
    rejectionReason,
  };
}
