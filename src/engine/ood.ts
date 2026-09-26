// LISA: Out-of-Distribution (OOD) & Spectral Anomaly Engine
// Detects when an unknown optical input deviates from the validated calibration manifold

import { OODResult } from '../types';
import { smoothSpectrum } from './spectrum';

// Minimum RMS (AU) of the 9-point-smoothed sample spectrum for a shape comparison to
// be meaningful. White detector noise is suppressed ~3× by the smoothing; a real
// chromophore band is not. Below this, the sample is indistinguishable from the
// 0 mg/L standards and its "shape" is noise, which correlates with nothing.
const SHAPE_TEST_MIN_RMS_AU = 0.008;

export interface CalibrationManifold {
  meanProfile: number[];       // Mean absorbance across 151 wavelengths
  stdProfile: number[];        // Standard deviation across 151 wavelengths
  standardConcentrations: number[];
  standardProfiles: number[][];
}

export function buildCalibrationManifold(
  standards: { concentration: number; absorbances: number[] }[]
): CalibrationManifold {
  const p = standards[0]?.absorbances.length || 151;
  const n = standards.length;

  const meanProfile = new Array(p).fill(0);
  const stdProfile = new Array(p).fill(0);

  for (let j = 0; j < p; j++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += standards[i].absorbances[j];
    }
    meanProfile[j] = sum / n;

    let varSum = 0;
    for (let i = 0; i < n; i++) {
      varSum += Math.pow(standards[i].absorbances[j] - meanProfile[j], 2);
    }
    stdProfile[j] = Math.sqrt(varSum / Math.max(1, n - 1)) + 0.015; // regularization epsilon
  }

  return {
    meanProfile,
    stdProfile,
    standardConcentrations: standards.map((s) => s.concentration),
    standardProfiles: standards.map((s) => s.absorbances),
  };
}

export function evaluateOOD(
  absorbances: number[],
  manifold: CalibrationManifold,
  analyteName: string = 'analyte'
): OODResult {
  const p = Math.min(absorbances.length, manifold.meanProfile.length);
  if (p < 20) {
    return {
      score: 1.0,
      status: 'IN_DISTRIBUTION',
      isAnomaly: false,
      nearestStandardConc: 0.4,
      detail: 'Insufficient spectral resolution for OOD determination.',
    };
  }

  // 1. Compute standardized Manhattan/Euclidean distance from spectral manifold
  let distSum = 0;
  for (let j = 0; j < p; j++) {
    const diff = Math.abs(absorbances[j] - manifold.meanProfile[j]);
    const normDiff = diff / manifold.stdProfile[j];
    distSum += normDiff;
  }
  const avgDistance = distSum / p;

  // 2. Find nearest calibration standard
  let minStandardDist = Infinity;
  let nearestConc = 0.0;

  for (let i = 0; i < manifold.standardProfiles.length; i++) {
    const stdProf = manifold.standardProfiles[i];
    let d = 0;
    for (let j = 0; j < p; j++) {
      d += Math.pow(absorbances[j] - stdProf[j], 2);
    }
    d = Math.sqrt(d);
    if (d < minStandardDist) {
      minStandardDist = d;
      nearestConc = manifold.standardConcentrations[i];
    }
  }

  // 3. Chemometric Spectral Shape Correlation (Spectral Angle / Pearson r)
  // Evaluates correlation against the target chromophore calibration manifold.
  let sumA = 0;
  let sumM = 0;
  for (let j = 0; j < p; j++) {
    sumA += absorbances[j];
    sumM += manifold.meanProfile[j];
  }
  const meanA = sumA / p;
  const meanM = sumM / p;

  let num = 0;
  let denomA = 0;
  let denomM = 0;
  for (let j = 0; j < p; j++) {
    const da = absorbances[j] - meanA;
    const dm = manifold.meanProfile[j] - meanM;
    num += da * dm;
    denomA += da * da;
    denomM += dm * dm;
  }

  const smoothed = smoothSpectrum(absorbances.slice(0, p), 9);
  const smoothMean = smoothed.reduce((a, b) => a + b, 0) / p;
  const structuredRms = Math.sqrt(smoothed.reduce((a, v) => a + (v - smoothMean) ** 2, 0) / p);
  const shapeCorr =
    structuredRms > SHAPE_TEST_MIN_RMS_AU && denomA > 1e-6 && denomM > 1e-6 ? num / Math.sqrt(denomA * denomM) : 1.0;

  // If shape correlation deviates strongly from target chromophore manifold (r < 0.70)
  const shapePenalty = shapeCorr < 0.70 ? Math.max(0, (0.75 - shapeCorr) * 4.5) : 0;
  const totalScore = parseFloat((avgDistance + shapePenalty).toFixed(2));

  let status: 'IN_DISTRIBUTION' | 'BORDERLINE' | 'OUT_OF_DISTRIBUTION' = 'IN_DISTRIBUTION';
  let isAnomaly = false;
  let detail = '';

  if (totalScore > 3.0 || shapeCorr < 0.35) {
    status = 'OUT_OF_DISTRIBUTION';
    isAnomaly = true;
    detail = `Spectral signature is outside validated calibration space (OOD Distance: ${totalScore}, Shape Correlation: ${shapeCorr.toFixed(2)}). Peak morphology does not match ${analyteName} chromophore.`;
  } else if (totalScore > 1.8 || shapeCorr < 0.75) {
    status = 'BORDERLINE';
    isAnomaly = false;
    detail = `Slight spectral divergence detected (OOD Distance: ${totalScore}, Shape Corr: ${shapeCorr.toFixed(2)}). Moderate confidence prediction.`;
  } else {
    status = 'IN_DISTRIBUTION';
    isAnomaly = false;
    detail = `Spectral profile concordant with ${analyteName} calibration manifold (OOD Distance: ${totalScore} ≤ 1.8, Shape Corr: ${shapeCorr.toFixed(2)}). High confidence.`;
  }

  return {
    score: totalScore,
    status,
    isAnomaly,
    nearestStandardConc: nearestConc,
    detail,
  };
}
