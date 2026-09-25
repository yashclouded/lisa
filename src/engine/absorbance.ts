// LISA: Beer-Lambert Absorbance Calculation
// Computes A(lambda) = -log10(I_sample / I_blank) with optical safeguards

export function computeAbsorbance(
  sampleIntensities: number[],
  blankIntensities: number[],
  sampleMatrixBlank?: number[]
): number[] {
  const n = Math.min(sampleIntensities.length, blankIntensities.length);
  const absorbances: number[] = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    const iBlank = Math.max(1e-4, blankIntensities[i]);
    const iSample = Math.max(1e-4, sampleIntensities[i]);

    // Transmittance T = I_sample / I_blank
    const transmittance = Math.max(1e-4, Math.min(2.0, iSample / iBlank));
    let abs = -Math.log10(transmittance);

    // If sample matrix blank is provided (for turbid or colored samples), subtract matrix background
    if (sampleMatrixBlank && sampleMatrixBlank.length > i) {
      const iMatrix = Math.max(1e-4, sampleMatrixBlank[i]);
      const matrixTransmittance = Math.max(1e-4, Math.min(2.0, iMatrix / iBlank));
      const matrixAbs = -Math.log10(matrixTransmittance);
      abs = Math.max(0, abs - matrixAbs);
    }

    // Physical upper clamp: 3.5 AU (0.03% transmission, detector floor)
    absorbances[i] = Math.max(0, Math.min(3.5, abs));
  }

  return absorbances;
}

// Integrated band absorbance over a specific wavelength window (e.g. 630-690 nm for phosphate)
export function integrateBandAbsorbance(
  wavelengths: number[],
  absorbances: number[],
  startNm: number,
  endNm: number
): number {
  let sum = 0;
  let count = 0;

  for (let i = 0; i < wavelengths.length; i++) {
    const nm = wavelengths[i];
    if (nm >= startNm && nm <= endNm) {
      sum += absorbances[i];
      count++;
    }
  }

  return count > 0 ? sum / count : 0;
}
