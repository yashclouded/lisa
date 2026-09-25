// LISA: Optical Cross-Correlation Alignment
// Corrects mechanical cuvette insertion shifts against reference blank

import { AlignmentResult, QCStatus } from '../types';

export function computeCrossCorrelationAlignment(
  blankProfile: number[],
  sampleProfile: number[],
  maxShift: number = 10
): { alignedProfile: number[]; result: AlignmentResult } {
  const n = Math.min(blankProfile.length, sampleProfile.length);
  if (n < 20) {
    return {
      alignedProfile: [...sampleProfile],
      result: {
        shiftPx: 0,
        correlation: 1.0,
        aligned: true,
        status: 'PASS',
        message: 'Profile length too short for cross-correlation; alignment skipped.',
      },
    };
  }

  // Mean-center both profiles for zero-lag normalized cross-correlation
  let blankMean = 0;
  let sampleMean = 0;
  for (let i = 0; i < n; i++) {
    blankMean += blankProfile[i];
    sampleMean += sampleProfile[i];
  }
  blankMean /= n;
  sampleMean /= n;

  let bestShift = 0;
  let maxCorr = -Infinity;

  for (let shift = -maxShift; shift <= maxShift; shift++) {
    let num = 0;
    let denomB = 0;
    let denomS = 0;
    let count = 0;

    for (let i = 0; i < n; i++) {
      const j = i + shift;
      if (j >= 0 && j < n) {
        const b = blankProfile[i] - blankMean;
        const s = sampleProfile[j] - sampleMean;
        num += b * s;
        denomB += b * b;
        denomS += s * s;
        count++;
      }
    }

    const r = denomB > 0 && denomS > 0 ? num / Math.sqrt(denomB * denomS) : 0;
    if (r > maxCorr) {
      maxCorr = r;
      bestShift = shift;
    }
  }

  // Construct aligned sample profile by shifting by -bestShift
  const alignedProfile: number[] = new Array(sampleProfile.length).fill(0);
  for (let i = 0; i < sampleProfile.length; i++) {
    const srcIdx = i + bestShift;
    if (srcIdx >= 0 && srcIdx < sampleProfile.length) {
      alignedProfile[i] = sampleProfile[srcIdx];
    } else if (srcIdx < 0) {
      alignedProfile[i] = sampleProfile[0];
    } else {
      alignedProfile[i] = sampleProfile[sampleProfile.length - 1];
    }
  }

  // Check tolerance: tolerance from agent.md is max 6 pixels
  let status: QCStatus = 'PASS';
  let message = `Spectral alignment verified (Shift: ${bestShift > 0 ? '+' : ''}${bestShift}px, Pearson r: ${maxCorr.toFixed(3)}).`;

  if (Math.abs(bestShift) > 6) {
    status = 'WARNING';
    message = `Excessive cuvette shift detected (${bestShift > 0 ? '+' : ''}${bestShift}px > ±6px). Check cuvette seating.`;
  } else if (maxCorr < 0.75) {
    status = 'WARNING';
    message = `Low spectral cross-correlation with blank (r = ${maxCorr.toFixed(2)}). Optical background may have changed.`;
  }

  return {
    alignedProfile,
    result: {
      shiftPx: bestShift,
      correlation: Math.max(-1, Math.min(1, maxCorr)),
      aligned: true,
      status,
      message,
    },
  };
}
