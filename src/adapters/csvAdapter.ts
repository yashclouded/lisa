// LISA: CSV / JSON Spectral File Parser Adapter

import { resampleSpectrum, validateSpectrum, STANDARD_WAVELENGTHS } from '../engine/spectrum';

export interface ParsedSpectrumResult {
  success: boolean;
  wavelengths: number[];
  intensities: number[];
  absorbances?: number[];
  isAbsorbanceDirect: boolean;
  error?: string;
  warning?: string;
}

export function parseSpectralCSV(csvText: string): ParsedSpectrumResult {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 5) {
    return {
      success: false,
      wavelengths: [],
      intensities: [],
      isAbsorbanceDirect: false,
      error: 'CSV file contains insufficient rows (minimum 5 required).',
    };
  }

  const rawWavelengths: number[] = [];
  const rawValues: number[] = [];
  let isAbsorbance = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

    // Check header
    if (i === 0 && (line.toLowerCase().includes('wavelength') || line.toLowerCase().includes('nm'))) {
      if (line.toLowerCase().includes('absorbance') || line.toLowerCase().includes('abs') || line.toLowerCase().includes('au')) {
        isAbsorbance = true;
      }
      continue;
    }

    const parts = line.split(/[,\t;]/).map((s) => s.trim());
    if (parts.length < 2) continue;

    const nm = parseFloat(parts[0]);
    const val = parseFloat(parts[1]);

    if (Number.isFinite(nm) && Number.isFinite(val)) {
      rawWavelengths.push(nm);
      rawValues.push(val);
    }
  }

  if (rawWavelengths.length < 10) {
    return {
      success: false,
      wavelengths: [],
      intensities: [],
      isAbsorbanceDirect: false,
      error: 'Could not extract at least 10 valid numeric wavelength/intensity pairs.',
    };
  }

  // Sort by wavelength if needed
  const paired = rawWavelengths.map((nm, idx) => ({ nm, val: rawValues[idx] }));
  paired.sort((a, b) => a.nm - b.nm);

  const sortedNm = paired.map((p) => p.nm);
  const sortedVal = paired.map((p) => p.val);

  const validation = validateSpectrum(sortedNm, sortedVal);
  if (!validation.isValid) {
    return {
      success: false,
      wavelengths: sortedNm,
      intensities: sortedVal,
      isAbsorbanceDirect: isAbsorbance,
      error: validation.errors.join('; '),
    };
  }

  // Resample onto standard 400-700 nm grid
  const resampled = resampleSpectrum(sortedNm, sortedVal, STANDARD_WAVELENGTHS);

  return {
    success: true,
    wavelengths: STANDARD_WAVELENGTHS,
    intensities: isAbsorbance ? [] : resampled,
    absorbances: isAbsorbance ? resampled : undefined,
    isAbsorbanceDirect: isAbsorbance,
    warning: validation.warnings.join('; '),
  };
}

export function parseSpectralJSON(jsonText: string): ParsedSpectrumResult {
  try {
    const data = JSON.parse(jsonText);
    const wavelengths: number[] = data.wavelengths || data.wavelength || [];
    const intensities: number[] = data.intensities || data.intensity || data.values || [];
    const absorbances: number[] | undefined = data.absorbances || data.absorbance;

    if (wavelengths.length < 10) {
      return {
        success: false,
        wavelengths: [],
        intensities: [],
        isAbsorbanceDirect: false,
        error: 'JSON must contain a "wavelengths" array with at least 10 points.',
      };
    }

    const values = absorbances && absorbances.length === wavelengths.length ? absorbances : intensities;
    const isAbs = !!absorbances;

    const resampled = resampleSpectrum(wavelengths, values, STANDARD_WAVELENGTHS);
    return {
      success: true,
      wavelengths: STANDARD_WAVELENGTHS,
      intensities: isAbs ? [] : resampled,
      absorbances: isAbs ? resampled : undefined,
      isAbsorbanceDirect: isAbs,
    };
  } catch (err: unknown) {
    return {
      success: false,
      wavelengths: [],
      intensities: [],
      isAbsorbanceDirect: false,
      error: `JSON parse error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
