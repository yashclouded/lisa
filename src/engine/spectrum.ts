// LISA: Spectral Signal Processing & Utilities

export const STANDARD_WAVELENGTHS: number[] = Array.from({ length: 151 }, (_, i) => 400 + i * 2);

export interface ValidationReport {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateSpectrum(wavelengths: number[], intensities: number[]): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (wavelengths.length !== intensities.length) {
    errors.push(`Length mismatch: ${wavelengths.length} wavelengths vs ${intensities.length} intensities`);
  }

  if (wavelengths.length < 10) {
    errors.push('Insufficient data points: minimum 10 required');
  }

  let isMonotonic = true;
  for (let i = 1; i < wavelengths.length; i++) {
    if (wavelengths[i] <= wavelengths[i - 1]) {
      isMonotonic = false;
      break;
    }
  }
  if (!isMonotonic) {
    errors.push('Wavelengths are not strictly monotonically increasing');
  }

  let nonFiniteCount = 0;
  let negativeCount = 0;
  for (let i = 0; i < intensities.length; i++) {
    const val = intensities[i];
    if (!Number.isFinite(val)) nonFiniteCount++;
    if (val < 0) negativeCount++;
  }

  if (nonFiniteCount > 0) {
    errors.push(`Contains ${nonFiniteCount} non-finite values (NaN / Infinity)`);
  }
  if (negativeCount > 0) {
    warnings.push(`Contains ${negativeCount} negative values (will be clamped to 0)`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// Resample a spectrum onto standard wavelengths (400-700 nm @ 2 nm) via linear interpolation
export function resampleSpectrum(
  inWavelengths: number[],
  inIntensities: number[],
  targetWavelengths: number[] = STANDARD_WAVELENGTHS
): number[] {
  const outIntensities: number[] = [];

  for (const targetNm of targetWavelengths) {
    if (targetNm <= inWavelengths[0]) {
      outIntensities.push(inIntensities[0]);
      continue;
    }
    if (targetNm >= inWavelengths[inWavelengths.length - 1]) {
      outIntensities.push(inIntensities[inIntensities.length - 1]);
      continue;
    }

    // Binary search for interval
    let low = 0;
    let high = inWavelengths.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (inWavelengths[mid] === targetNm) {
        low = mid;
        break;
      }
      if (inWavelengths[mid] < targetNm) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const idx = Math.max(0, Math.min(inWavelengths.length - 2, low - 1));
    const x0 = inWavelengths[idx];
    const x1 = inWavelengths[idx + 1];
    const y0 = inIntensities[idx];
    const y1 = inIntensities[idx + 1];

    const t = (targetNm - x0) / (x1 - x0 || 1);
    const interp = y0 + t * (y1 - y0);
    outIntensities.push(Math.max(0, interp));
  }

  return outIntensities;
}

// Moving average smoothing
export function smoothSpectrum(intensities: number[], windowSize: number = 3): number[] {
  if (windowSize <= 1) return [...intensities];
  const half = Math.floor(windowSize / 2);
  const smoothed: number[] = [];

  for (let i = 0; i < intensities.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = -half; j <= half; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < intensities.length) {
        sum += intensities[idx];
        count++;
      }
    }
    smoothed.push(sum / count);
  }
  return smoothed;
}

// Robust frame aggregation (average, median, trimmed mean)
export function aggregateFrames(frames: number[][], mode: 'mean' | 'median' | 'trimmed' = 'trimmed'): number[] {
  if (frames.length === 0) return [];
  if (frames.length === 1) return [...frames[0]];

  const numPoints = frames[0].length;
  const result: number[] = new Array(numPoints).fill(0);

  for (let p = 0; p < numPoints; p++) {
    const colValues: number[] = [];
    for (let f = 0; f < frames.length; f++) {
      colValues.push(frames[f][p]);
    }
    colValues.sort((a, b) => a - b);

    if (mode === 'median') {
      const mid = Math.floor(colValues.length / 2);
      result[p] = colValues.length % 2 !== 0 ? colValues[mid] : (colValues[mid - 1] + colValues[mid]) / 2;
    } else if (mode === 'trimmed' && colValues.length >= 4) {
      // Discard 10% highest and lowest
      const trimCount = Math.max(1, Math.floor(colValues.length * 0.1));
      let sum = 0;
      let count = 0;
      for (let i = trimCount; i < colValues.length - trimCount; i++) {
        sum += colValues[i];
        count++;
      }
      result[p] = sum / count;
    } else {
      // Standard mean
      const sum = colValues.reduce((a, b) => a + b, 0);
      result[p] = sum / colValues.length;
    }
  }

  return result;
}

// Convert wavelength to approximate RGB hex for realistic dispersion rendering
export function wavelengthToRGB(nm: number): string {
  let r = 0;
  let g = 0;
  let b = 0;

  if (nm >= 380 && nm < 440) {
    r = -(nm - 440) / (440 - 380);
    g = 0.0;
    b = 1.0;
  } else if (nm >= 440 && nm < 490) {
    r = 0.0;
    g = (nm - 440) / (490 - 440);
    b = 1.0;
  } else if (nm >= 490 && nm < 510) {
    r = 0.0;
    g = 1.0;
    b = -(nm - 510) / (510 - 490);
  } else if (nm >= 510 && nm < 580) {
    r = (nm - 510) / (580 - 510);
    g = 1.0;
    b = 0.0;
  } else if (nm >= 580 && nm < 645) {
    r = 1.0;
    g = -(nm - 645) / (645 - 580);
    b = 0.0;
  } else if (nm >= 645 && nm <= 780) {
    r = 1.0;
    g = 0.0;
    b = 0.0;
  }

  // Intensity factor falls off near spectrum edges
  let factor = 0.0;
  if (nm >= 380 && nm < 420) {
    factor = 0.3 + (0.7 * (nm - 380)) / (420 - 380);
  } else if (nm >= 420 && nm <= 700) {
    factor = 1.0;
  } else if (nm > 700 && nm <= 780) {
    factor = 0.3 + (0.7 * (780 - nm)) / (780 - 700);
  }

  const red = Math.round(Math.max(0, Math.min(255, r * factor * 255)));
  const green = Math.round(Math.max(0, Math.min(255, g * factor * 255)));
  const blue = Math.round(Math.max(0, Math.min(255, b * factor * 255)));

  return `rgb(${red}, ${green}, ${blue})`;
}
