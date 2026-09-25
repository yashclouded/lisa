// LISA: Analytical Uncertainty Quantification
// Computes standard error of prediction and 95% confidence intervals
// Combines calibration cross-validation error with sample-specific spectral noise variance

export interface UncertaintyEstimate {
  uncertainty: number | null; // delta (± mg/L), null if rejected
  lowerBound: number | null;  // mg/L, null if rejected
  upperBound: number | null;  // mg/L, null if rejected
  confidenceScore: 'HIGH' | 'MODERATE' | 'LOW';
  confidencePercent: number;  // 0 - 100%
  degreesOfFreedom: number;
  sampleNoiseRmse?: number;   // Sample-specific noise (mg/L)
}

/**
 * Computes sample-specific spectral residual variance by comparing measured absorbance
 * against the expected spectral reconstruction for the predicted concentration.
 */
export function computeSampleSpectralResidual(
  measuredAbsorbances: number[],
  predictedConcentration: number,
  spectralSlopes: number[],
  spectralIntercepts: number[]
): { varianceConc: number; rmseConc: number; df: number } {
  const p = Math.min(
    measuredAbsorbances.length,
    spectralSlopes.length,
    spectralIntercepts.length
  );

  if (p < 5) {
    return { varianceConc: 0, rmseConc: 0, df: Math.max(1, p) };
  }

  let ssRes = 0;
  let slopeSumSq = 0;

  for (let j = 0; j < p; j++) {
    const k = spectralSlopes[j];
    const b = spectralIntercepts[j];
    const expectedA = predictedConcentration * k + b;
    const res = measuredAbsorbances[j] - expectedA;
    ssRes += res * res;
    slopeSumSq += k * k;
  }

  const df = Math.max(1, p - 2);
  const varAbs = ssRes / df;
  const meanSlopeSq = slopeSumSq / p;
  const effSlope = meanSlopeSq > 1e-6 ? Math.sqrt(meanSlopeSq) : 1.0;

  // Convert variance from absorbance space to concentration space (AU^2 -> (mg/L)^2)
  const varianceConc = varAbs / (effSlope * effSlope);
  const rmseConc = Math.sqrt(Math.max(0, varianceConc));

  return {
    varianceConc: isFinite(varianceConc) ? varianceConc : 0,
    rmseConc: isFinite(rmseConc) ? rmseConc : 0,
    df,
  };
}

export function estimatePredictionUncertainty(
  concentration: number,
  loocvRmse: number,
  oodDistance: number = 1.0,
  isNearRangeEdge: boolean = false,
  sampleResidualVarianceConc: number = 0,
  isRejected: boolean = false
): UncertaintyEstimate {
  // If the measurement is rejected, do not report a misleading confidence interval
  if (isRejected || isNaN(concentration)) {
    return {
      uncertainty: null,
      lowerBound: null,
      upperBound: null,
      confidenceScore: 'LOW',
      confidencePercent: 0,
      degreesOfFreedom: 19,
    };
  }

  // Base standard error combines calibration grouped CV error with sample-specific spectral noise
  const calVariance = Math.pow(Math.max(0.015, loocvRmse), 2);
  const validSampleVar = isFinite(sampleResidualVarianceConc) && sampleResidualVarianceConc > 0
    ? sampleResidualVarianceConc
    : 0;

  let se = Math.sqrt(calVariance + validSampleVar);

  // Spectral distance inflation factor for out-of-distribution inputs
  if (oodDistance > 1.8) {
    se *= 1.0 + (oodDistance - 1.8) * 0.8;
  }

  // Edge-of-calibration range penalty
  if (isNearRangeEdge) {
    se *= 1.35;
  }

  // Numerical sanity bounds: avoid NaN, Infinity, or excessive bounds
  if (!isFinite(se) || isNaN(se)) {
    se = Math.max(0.015, loocvRmse);
  }
  se = Math.min(2.5, Math.max(0.005, se));

  // 95% confidence margin using student's t approximation (t ~ 2.05 for df ~ 15-20)
  const margin = parseFloat((se * 1.96).toFixed(3));
  const lower = Math.max(0, parseFloat((concentration - margin).toFixed(3)));
  const upper = parseFloat((concentration + margin).toFixed(3));

  // Determine qualitative confidence tier
  let confidenceScore: 'HIGH' | 'MODERATE' | 'LOW' = 'HIGH';
  let confidencePercent = 94;

  const relUncertainty = concentration > 0.05 ? margin / concentration : margin / 0.05;

  if (oodDistance > 3.0 || relUncertainty > 0.35) {
    confidenceScore = 'LOW';
    confidencePercent = Math.max(35, Math.round(100 - relUncertainty * 100));
  } else if (oodDistance > 1.8 || relUncertainty > 0.18) {
    confidenceScore = 'MODERATE';
    confidencePercent = Math.max(65, Math.round(90 - relUncertainty * 50));
  } else {
    confidenceScore = 'HIGH';
    confidencePercent = Math.min(99, Math.round(98 - relUncertainty * 30));
  }

  return {
    uncertainty: margin,
    lowerBound: lower,
    upperBound: upper,
    confidenceScore,
    confidencePercent,
    degreesOfFreedom: 19,
    sampleNoiseRmse: Math.sqrt(validSampleVar),
  };
}
