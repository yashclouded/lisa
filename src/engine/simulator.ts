// LISA: Physics-Based Optical Simulator
// Generates physically realistic LED transmission & analyte absorption spectra

import { STANDARD_WAVELENGTHS } from './spectrum';
import { SeededPRNG, defaultPRNG } from './prng';
import { DEMO_DEVICES } from './deviceCalibration';

// Named interferent chromophores. Each profile is unit-peak absorbance (1 AU at its
// maximum); `peakAU` scales it. Shapes are literature-typical band positions,
// approximated as Gaussians — they are simulated spectra, not measured ones.
export type InterferentKind = 'tartrazine' | 'chlorophyll' | 'red_dye' | 'humic';

export const INTERFERENTS: Record<InterferentKind, { label: string; note: string; profile: (nm: number) => number }> = {
  tartrazine: {
    label: 'Tartrazine-like yellow dye',
    note: 'Azo dye, λmax ≈ 426 nm. No absorbance in the phosphate band.',
    profile: (nm) => Math.exp(-Math.pow((nm - 426) / 28, 2)) + 0.07 * Math.exp(-Math.pow((nm - 500) / 20, 2)),
  },
  chlorophyll: {
    label: 'Chlorophyll-like pigment',
    note: 'Soret band ≈ 430 nm plus a Q band ≈ 663 nm that overlaps the phosphate band.',
    profile: (nm) => Math.exp(-Math.pow((nm - 432) / 18, 2)) + 0.62 * Math.exp(-Math.pow((nm - 663) / 11, 2)),
  },
  red_dye: {
    label: 'Generic red dye',
    note: 'Allura-red-like, λmax ≈ 504 nm — close to the lead band.',
    profile: (nm) => Math.exp(-Math.pow((nm - 504) / 38, 2)),
  },
  humic: {
    label: 'Broad organic (humic) colour',
    note: 'Featureless absorbance rising toward the blue, ∝ λ^-2.5.',
    profile: (nm) => Math.pow(450 / nm, 2.5),
  },
};

// Simulated colour-development kinetics: fraction developed f(t) = 1 − exp(−k·t).
// Rate constants are illustrative (chosen so phosphate is ~95 % developed at the
// 10-minute read time of EPA 365.3); they are not fitted to measured kinetics.
export const REACTION_RATE_PER_MIN: Record<string, number> = { phosphate: 0.3, lead: 1.2, iron: 0.6 };

export const reactionProgress = (analyte: string, reactionTimeMin?: number) =>
  reactionTimeMin === undefined || !(analyte in REACTION_RATE_PER_MIN)
    ? 1
    : 1 - Math.exp(-REACTION_RATE_PER_MIN[analyte] * Math.max(0, reactionTimeMin));

export interface SimulationParams {
  analyte: 'phosphate' | 'iron' | 'lead' | 'anomaly';
  concentration: number;          // mg/L
  noiseLevel: number;             // 0.0 to 1.0 (default ~0.02)
  illuminationDrift: number;      // -0.2 to +0.2 (default 0.0)
  shiftPx: number;                // mechanical shift (-10 to +10 px)
  isSaturated: boolean;           // simulate over-exposure
  turbidityAU: number;            // 0.0 to 0.8 AU
  colorInterferenceAU: number;    // 0.0 to 0.6 AU
  deviceProfileId?: string;       // device A, B, C, D
  // --- Physical extensions (all optional; defaults reproduce the legacy output bit-for-bit) ---
  pathLengthCm?: number;          // cuvette path length l (default 1.0 cm)
  reactionTimeMin?: number;       // minutes since reagent addition; undefined = end-point
  exposure?: number;              // relative exposure × gain (default 1.0; LED peak ≈ 235/255)
  ambientLightCounts?: number;    // stray/ambient light reaching the sensor in both captures (8-bit counts)
  sourceDrift?: number;           // LED output change between blank and sample capture (fraction)
  interferents?: { kind: InterferentKind; peakAU: number }[];
}

// Normalized High-CRI White LED emission spectrum (400-700 nm)
export function getWhiteLEDBaseProfile(wavelengths: number[] = STANDARD_WAVELENGTHS): number[] {
  return wavelengths.map((nm) => {
    // 1. Blue GaN pump diode peak at ~450 nm (narrow)
    const blueGaN = 190 * Math.exp(-Math.pow((nm - 450) / 14, 2));

    // 2. Broad YAG:Ce phosphor emission peak at ~560 nm (wide yellow/red)
    const phosphor = 170 * Math.exp(-Math.pow((nm - 565) / 55, 2));

    // 3. Red phosphor enhancement ~630 nm
    const redPhos = 90 * Math.exp(-Math.pow((nm - 625) / 35, 2));

    // Base dark count ~10
    const raw = 12 + blueGaN + phosphor + redPhos;
    return Math.min(235, Math.max(15, raw));
  });
}

// Specific extinction coefficient epsilon(lambda) for target chromophores
export function getMolarExtinctionProfile(
  analyte: 'phosphate' | 'iron' | 'lead' | 'anomaly',
  wavelengths: number[] = STANDARD_WAVELENGTHS
): number[] {
  return wavelengths.map((nm) => {
    if (analyte === 'phosphate') {
      // Molybdenum blue complex: US EPA 365.3
      // Strong absorption rising above 580 nm, peak around 670-690 nm in visible, plateauing into NIR
      if (nm < 520) {
        return 0.02 + 0.03 * Math.exp(-Math.pow((nm - 400) / 40, 2)); // slight UV tail
      }
      // Main 675 nm peak (visible band)
      const visiblePeak = 1.35 * Math.exp(-Math.pow((nm - 680) / 42, 2));
      const nirRise = 0.5 * (1 / (1 + Math.exp(-(nm - 650) / 25)));
      return visiblePeak + nirRise;
    }

    if (analyte === 'iron') {
      // 1,10-Phenanthroline iron(II) complex: APHA 3500-Fe B
      // Strong orange-red complex with sharp peak at 508-510 nm
      const peak = 1.65 * Math.exp(-Math.pow((nm - 510) / 28, 2));
      const tail = nm > 550 ? 0.01 : 0.05 * Math.exp(-Math.pow((nm - 420) / 30, 2));
      return peak + tail;
    }

    if (analyte === 'lead') {
      // Lead dithizonate (Pb(HDz)₂), mono-colour method: pink-red, λmax ≈ 520 nm.
      // ε ≈ 6.9×10⁴ L·mol⁻¹·cm⁻¹ ÷ 207.2 g/mol ≈ 0.33 AU per mg Pb/L per cm, FWHM ≈ 80 nm.
      // At the 0.01 mg/L drinking-water limit this is ~0.003 AU — below a phone's noise floor
      // without pre-concentration, which is why lead stays a roadmap analyte.
      return 0.33 * Math.exp(-Math.pow((nm - 520) / 48, 2));
    }

    // Anomaly / Food Dye / Contaminant (e.g. Tartrazine Yellow No. 5)
    // Strong absorption at 426 nm, completely zero at 600-700 nm (inverted from molybdenum blue)
    const yellowPeak = 2.2 * Math.exp(-Math.pow((nm - 426) / 28, 2));
    const greenTail = 0.15 * Math.exp(-Math.pow((nm - 500) / 20, 2));
    return yellowPeak + greenTail;
  });
}

export function simulateSpectrum(
  rawParams: Partial<SimulationParams> & { analyte: 'phosphate' | 'iron' | 'lead' | 'anomaly'; concentration: number },
  prng: SeededPRNG = defaultPRNG,
  wavelengths: number[] = STANDARD_WAVELENGTHS
): {
  wavelengths: number[];
  blankIntensities: number[];
  sampleIntensities: number[];
  trueAbsorbance: number[];
  /** True absorbance split by physical cause (AU, at the simulated path length). */
  components: { analyte: number[]; interferent: number[]; scatter: number[] };
  reactionProgress: number;
} {
  const params: SimulationParams = {
    analyte: rawParams.analyte || 'phosphate',
    concentration: rawParams.concentration ?? 0.0,
    noiseLevel: rawParams.noiseLevel ?? 0.015,
    illuminationDrift: rawParams.illuminationDrift ?? 0.0,
    shiftPx: rawParams.shiftPx ?? 0,
    isSaturated: rawParams.isSaturated ?? false,
    turbidityAU: rawParams.turbidityAU ?? 0.0,
    colorInterferenceAU: rawParams.colorInterferenceAU ?? 0.0,
    deviceProfileId: rawParams.deviceProfileId,
  };

  const baseLED = getWhiteLEDBaseProfile(wavelengths);
  const extinction = getMolarExtinctionProfile(params.analyte, wavelengths);
  const n = wavelengths.length;
  const exposure = rawParams.exposure ?? 1.0;
  const ambient = rawParams.ambientLightCounts ?? 0;
  const sourceDrift = 1.0 + (rawParams.sourceDrift ?? 0);
  const progress = reactionProgress(params.analyte, rawParams.reactionTimeMin);
  const interferents = rawParams.interferents ?? [];
  // Handset response comes from the same DeviceProfile the pipeline normalises with,
  // so device calibration inverts exactly what the simulator applied.
  const device = DEMO_DEVICES.find((d) => d.id === params.deviceProfileId);

  const blankIntensities: number[] = new Array(n).fill(0);
  const sampleIntensities: number[] = new Array(n).fill(0);
  const trueAbsorbance: number[] = new Array(n).fill(0);
  const components = { analyte: new Array(n).fill(0), interferent: new Array(n).fill(0), scatter: new Array(n).fill(0) };

  // Optical path length (Beer–Lambert l), default 1.0 cm
  const pathLengthCm = rawParams.pathLengthCm ?? 1.0;

  // Multiplicative illumination drift factor
  const driftFactor = 1.0 + params.illuminationDrift;

  for (let i = 0; i < n; i++) {
    const nm = wavelengths[i];

    // Blank transmission
    const ledLight = baseLED[i] * driftFactor * exposure; // photons from the LED, before the sensor clips
    let iBlank = ledLight + ambient;
    // Add small sensor noise to blank
    iBlank += prng.gaussian(0, params.noiseLevel * 4);
    iBlank = Math.max(10 * Math.min(1, exposure), Math.min(255, iBlank));
    blankIntensities[i] = iBlank;

    // Analyte absorbance A = epsilon * l * c, scaled by how far the colour has developed
    let abs = extinction[i] * pathLengthCm * params.concentration * progress;
    components.analyte[i] = abs;

    // Interferent chromophores in the same cuvette (also ∝ path length)
    for (const it of interferents) {
      const a = INTERFERENTS[it.kind].profile(nm) * it.peakAU * pathLengthCm;
      abs += a;
      components.interferent[i] += a;
    }

    // Turbidity (Mie scattering: ~ lambda^-1)
    if (params.turbidityAU > 0) {
      const mieScale = 550 / nm;
      abs += params.turbidityAU * mieScale;
      components.scatter[i] = params.turbidityAU * mieScale;
    }

    // Organic color background (e.g. humic acid yellowing: ~ lambda^-3)
    if (params.colorInterferenceAU > 0) {
      const colorScale = Math.pow(450 / nm, 2.5);
      abs += params.colorInterferenceAU * colorScale;
      components.interferent[i] += params.colorInterferenceAU * colorScale;
    }

    trueAbsorbance[i] = Math.max(0, abs);

    // Sample transmission: I_sample = I_blank * 10^(-A). Only the LED light is attenuated;
    // ambient stray light reaches the sensor unattenuated (classic stray-light error).
    // Legacy path (no ambient, drift or exposure change) keeps the exact original arithmetic.
    let iSample =
      ambient === 0 && sourceDrift === 1 && exposure === 1
        ? iBlank * Math.pow(10, -abs)
        : ledLight * sourceDrift * Math.pow(10, -abs) + ambient;

    // Handset spectral sensitivity. Assumption: the blank I₀ is the reference-handset
    // blank stored with the calibration, so a different phone's response does not cancel.
    if (device && params.deviceProfileId !== 'device-a-reference') {
      iSample *= device.spectralSensitivity[i] ?? 1;
    }
    if (params.deviceProfileId === 'device-d-budget') {
      // Budget sensor: higher noise + slight nonlinearity
      iSample += prng.gaussian(0, 4.5);
    }

    // Add Gaussian detector noise
    const noise = prng.gaussian(0, params.noiseLevel * (5 + Math.sqrt(Math.max(1, iSample))));
    iSample += noise;

    // Saturation clipping
    if (params.isSaturated) {
      iSample = 255;
    } else {
      iSample = Math.max(2, Math.min(255, iSample));
    }

    sampleIntensities[i] = iSample;
  }

  // Apply mechanical shift (+ the handset's own wavelength-registration offset). 1 px = one 2 nm bin.
  const totalShift = params.shiftPx + (device && device.id !== 'device-a-reference' ? device.wavelengthOffsetPx : 0);
  if (totalShift !== 0) {
    const shifted: number[] = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      const srcIdx = i + totalShift;
      if (srcIdx >= 0 && srcIdx < n) {
        shifted[i] = sampleIntensities[srcIdx];
      } else if (srcIdx < 0) {
        shifted[i] = sampleIntensities[0];
      } else {
        shifted[i] = sampleIntensities[n - 1];
      }
    }
    for (let i = 0; i < n; i++) {
      sampleIntensities[i] = shifted[i];
    }
  }

  return {
    wavelengths: [...wavelengths],
    blankIntensities,
    sampleIntensities,
    trueAbsorbance,
    components,
    reactionProgress: progress,
  };
}
