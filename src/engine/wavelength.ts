// LISA: Atomic Emission Wavelength Calibration
// Fits pixel column -> wavelength (nm) using CFL mercury/terbium/europium emission lines

import { WavelengthFit } from '../types';

export const CFL_REFERENCE_LINES = [
  { name: 'Hg Blue', trueNm: 435.83, expectedNormPos: 0.12 },
  { name: 'Hg Green', trueNm: 546.07, expectedNormPos: 0.49 },
  { name: 'Eu Red 1', trueNm: 611.20, expectedNormPos: 0.70 },
  { name: 'Eu Red 2', trueNm: 631.00, expectedNormPos: 0.77 },
];

export function fitWavelengthCalibration(
  peakPixelPositions: { lineName: string; pixel: number }[],
  _totalPixels: number = 1000
): WavelengthFit {
  const points: { x: number; y: number; name: string }[] = [];

  for (const item of peakPixelPositions) {
    const ref = CFL_REFERENCE_LINES.find((r) => r.name === item.lineName);
    if (ref) {
      points.push({ x: item.pixel, y: ref.trueNm, name: ref.name });
    }
  }

  // Explicit failure if fewer than 2 points
  if (points.length < 2) {
    return {
      isValid: false,
      errorCode: 'INSUFFICIENT_CALIBRATION_POINTS',
      slope: 0,
      intercept: 0,
      r2: null,
      residualRms: null,
      referenceLines: [],
    };
  }

  // Linear Least Squares: y = slope * x + intercept
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  const n = points.length;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  }

  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-12) {
    return {
      isValid: false,
      errorCode: 'DEGENERATE_CALIBRATION_POINTS',
      slope: 0,
      intercept: 0,
      r2: null,
      residualRms: null,
      referenceLines: [],
    };
  }

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R2 and residuals
  const meanY = sumY / n;
  let ssTot = 0;
  let ssRes = 0;
  const referenceLines = points.map((p) => {
    const fitted = slope * p.x + intercept;
    const residual = p.y - fitted;
    ssTot += Math.pow(p.y - meanY, 2);
    ssRes += Math.pow(residual, 2);
    return {
      name: p.name,
      trueNm: p.y,
      pixel: p.x,
      fittedNm: parseFloat(fitted.toFixed(2)),
    };
  });

  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : (ssRes === 0 ? 1.0 : null);
  const residualRms = Math.sqrt(ssRes / n);

  return {
    isValid: true,
    slope,
    intercept,
    r2: r2 !== null ? parseFloat(r2.toFixed(4)) : null,
    residualRms: parseFloat(residualRms.toFixed(2)),
    referenceLines,
  };
}

// Convert pixel coordinate to wavelength (nm)
export function pixelToWavelength(pixel: number, fit: WavelengthFit): number {
  if (!fit.isValid) return NaN;
  return fit.slope * pixel + fit.intercept;
}

// Convert wavelength (nm) to pixel coordinate
export function wavelengthToPixel(nm: number, fit: WavelengthFit): number {
  if (!fit.isValid || Math.abs(fit.slope) < 1e-12) return NaN;
  return (nm - fit.intercept) / fit.slope;
}
