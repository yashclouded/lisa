// LISA Digital Twin — physical model + glue to the production engine.
//
// Everything numeric that the twin shows comes from here, and everything here
// either (a) calls the production simulator / pipeline unchanged, or (b) is
// optical geometry taken from the build plan (1000 lines/mm grating, 33° wedge).
// There is no second scientific engine: the 3D layer only visualises these values.

import { SimulationParams, getWhiteLEDBaseProfile } from '../engine/simulator';
import { runSimulation, SimulationState } from '../simulation/state';
import { STANDARD_WAVELENGTHS, wavelengthToRGB } from '../engine/spectrum';
import { fitWavelengthCalibration, CFL_REFERENCE_LINES } from '../engine/wavelength';

// ---------------------------------------------------------------------------
// Optics — from the build plan (agent.md §Grating Mounting / Angular Wedge):
// a 1000 lines/mm transmission film is taped over the phone lens and the tube
// meets the phone on a wedge at α₀ = asin(550/d) ≈ 33.4°, so light arrives at
// the grating at incidence −α₀ and first-order green leaves along the camera
// axis. Grating equation: sin θ = λ/d − sin α₀ (θ measured from the camera
// axis). The lens maps angle to sensor position like a pinhole: x = f·tan θ.
// ---------------------------------------------------------------------------

export const GRATING_LINES_PER_MM = 1000;
export const GRATING_PERIOD_NM = 1e6 / GRATING_LINES_PER_MM;
export const WEDGE_ANGLE_RAD = Math.asin(550 / GRATING_PERIOD_NM);

/** First-order angle from the camera axis for wavelength `nm`. */
export const diffractionAngle = (nm: number) =>
  Math.asin(nm / GRATING_PERIOD_NM - Math.sin(WEDGE_ANGLE_RAD));
/** Sensor position of wavelength `nm`, in units of the lens focal length. */
export const sensorX = (nm: number) => Math.tan(diffractionAngle(nm));
export const wavelengthAtSensorX = (x: number) =>
  GRATING_PERIOD_NM * (Math.sin(Math.atan(x)) + Math.sin(WEDGE_ANGLE_RAD));

// The sensor window spans a little beyond the 400–700 nm analysis range.
export const SENSOR_X_MIN = sensorX(385);
export const SENSOR_X_MAX = sensorX(715);
export const SENSOR_COLUMNS = 1000;

export const pixelOfWavelength = (nm: number) =>
  ((sensorX(nm) - SENSOR_X_MIN) / (SENSOR_X_MAX - SENSOR_X_MIN)) * (SENSOR_COLUMNS - 1);

/**
 * Wavelength calibration of the twin's sensor, done exactly as on hardware:
 * locate the CFL reference lines on the sensor, then run the production
 * linear fit λ(p) = a·p + b. The residual is the real non-linearity of the
 * grating + lens geometry that a linear calibration leaves behind.
 */
export const SENSOR_CALIBRATION = fitWavelengthCalibration(
  CFL_REFERENCE_LINES.map((l) => ({ lineName: l.name, pixel: pixelOfWavelength(l.trueNm) })),
  SENSOR_COLUMNS
);

// ---------------------------------------------------------------------------
// Colour helpers — derived from the simulated arrays, never hand-picked.
// ---------------------------------------------------------------------------

export type RGB = [number, number, number];

export const nmToRGB = (nm: number): RGB => {
  const m = wavelengthToRGB(nm).match(/\d+/g);
  return m ? [+m[0] / 255, +m[1] / 255, +m[2] / 255] : [0, 0, 0];
};

const lerpArray = (xs: number[], ys: number[], x: number) => {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  const step = xs[1] - xs[0];
  const i = Math.min(xs.length - 2, Math.floor((x - xs[0]) / step));
  const t = (x - xs[i]) / step;
  return ys[i] + t * (ys[i + 1] - ys[i]);
};

const LED = getWhiteLEDBaseProfile(STANDARD_WAVELENGTHS);
const LED_RGB = STANDARD_WAVELENGTHS.map(nmToRGB);

/**
 * Perceived colour of light after the cuvette: LED spectrum × T(λ), projected
 * to RGB and normalised against the unattenuated LED so a blank reads white.
 * T(λ) = I_sample / I_blank from the simulated arrays (noise included).
 */
export function transmittedColor(blank: number[], sample: number[]): { rgb: RGB; luminance: number } {
  const acc: RGB = [0, 0, 0];
  const ref: RGB = [0, 0, 0];
  for (let i = 0; i < STANDARD_WAVELENGTHS.length; i++) {
    const t = Math.max(0, Math.min(1, sample[i] / Math.max(1, blank[i])));
    for (let c = 0; c < 3; c++) {
      acc[c] += LED[i] * LED_RGB[i][c] * t;
      ref[c] += LED[i] * LED_RGB[i][c];
    }
  }
  const rgb = acc.map((v, c) => v / ref[c]) as RGB;
  return { rgb, luminance: 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] };
}

/**
 * Renders what the phone sensor sees: each column is a wavelength placed by
 * the grating geometry, brightness is the simulated 8-bit intensity at that
 * wavelength. This is a rendering of the simulated I(λ), not a camera frame.
 */
export function drawSensorFrame(
  canvas: HTMLCanvasElement,
  intensities: number[],
  wavelengths: number[] = STANDARD_WAVELENGTHS
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  const img = ctx.createImageData(w, h);
  const lo = wavelengths[0];
  const hi = wavelengths[wavelengths.length - 1];
  for (let px = 0; px < w; px++) {
    const x = SENSOR_X_MIN + ((px + 0.5) / w) * (SENSOR_X_MAX - SENSOR_X_MIN);
    const nm = wavelengthAtSensorX(x);
    // Outside the 400–700 nm window the simulator has no data: render dark.
    const level = nm < lo || nm > hi ? 0 : Math.max(0, lerpArray(wavelengths, intensities, nm)) / 255;
    const [r, g, b] = nmToRGB(nm);
    for (let py = 0; py < h; py++) {
      // Vertical profile of the slit image — a soft-edged line.
      const v = (py + 0.5) / h - 0.5;
      const slit = Math.exp(-Math.pow(v / 0.3, 6));
      const k = level * slit * 255;
      const o = (py * w + px) * 4;
      img.data[o] = r * k + 6;
      img.data[o + 1] = g * k + 7;
      img.data[o + 2] = b * k + 9;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------------------
// Scenarios & faults — each one is just a set of production simulator params.
// ---------------------------------------------------------------------------

export const BASE_PARAMS: SimulationParams = {
  analyte: 'phosphate',
  concentration: 0.4,
  noiseLevel: 0.015,
  illuminationDrift: 0,
  shiftPx: 0,
  isSaturated: false,
  turbidityAU: 0,
  colorInterferenceAU: 0,
};

/** Chemistries the twin can put in the cuvette. Only phosphate is calibrated. */
export const CHEMISTRIES = [
  { id: 'phosphate', label: 'Phosphate', unit: 'mg P/L', analyteId: 'phosphate', max: 1.5, step: 0.01, mark: '1.00 calibrated max' },
  { id: 'lead', label: 'Lead', unit: 'mg Pb/L', analyteId: 'lead', max: 2, step: 0.005, mark: '0.01 IS 10500 limit' },
  { id: 'anomaly', label: 'Unknown dye', unit: 'mg/L', analyteId: 'phosphate', max: 1.5, step: 0.01, mark: '' },
] as const;

export const chemistryOf = (analyte: SimulationParams['analyte']) =>
  CHEMISTRIES.find((c) => c.id === analyte) ?? CHEMISTRIES[0];

export interface TwinScenario {
  id: string;
  label: string;
  description: string;
  params: SimulationParams;
  deviceId: string;
}

export const SCENARIOS: TwinScenario[] = [
  {
    id: 'clean_phosphate',
    label: 'Clean sample',
    description: '0.40 mg P/L, reference handset, nominal detector noise.',
    params: { ...BASE_PARAMS },
    deviceId: 'device-a-reference',
  },
  {
    id: 'noisy_sample',
    label: 'Noisy sample',
    description: 'Detector noise ×10. The estimate holds; the uncertainty widens.',
    params: { ...BASE_PARAMS, noiseLevel: 0.15 },
    deviceId: 'device-a-reference',
  },
  {
    id: 'turbid_sample',
    label: 'Turbid water',
    description: 'Suspended clay scattering (0.40 AU at 550 nm, ∝ λ⁻¹).',
    params: { ...BASE_PARAMS, turbidityAU: 0.4 },
    deviceId: 'device-a-reference',
  },
  {
    id: 'misaligned_sample',
    label: 'Misaligned cuvette',
    description: 'Cuvette seated 8 px off the registered optical axis.',
    params: { ...BASE_PARAMS, shiftPx: 8 },
    deviceId: 'device-a-reference',
  },
  {
    id: 'saturated_sample',
    label: 'Saturated sensor',
    description: 'Exposure too long — every sample pixel clips at 255.',
    params: { ...BASE_PARAMS, isSaturated: true },
    deviceId: 'device-a-reference',
  },
  {
    id: 'lead_sample',
    label: 'Lead (simulated)',
    description: '0.50 mg Pb/L as the dithizone complex. LISA processes Lead through simulated calibration.',
    params: { ...BASE_PARAMS, analyte: 'lead', concentration: 0.5 },
    deviceId: 'device-a-reference',
  },
  {
    id: 'unknown_dye',
    label: 'Unknown chemistry',
    description: 'Cuvette holds a yellow azo dye (tartrazine-like, peak 426 nm), not molybdenum blue.',
    params: { ...BASE_PARAMS, analyte: 'anomaly' },
    deviceId: 'device-a-reference',
  },
];

export type FaultId = 'noise' | 'shift' | 'saturate' | 'turbid' | 'humic' | 'dye';

export const FAULTS: { id: FaultId; label: string; apply: (p: SimulationParams) => SimulationParams }[] = [
  { id: 'noise', label: 'Excess noise', apply: (p) => ({ ...p, noiseLevel: 0.3 }) },
  { id: 'shift', label: 'Severe shift', apply: (p) => ({ ...p, shiftPx: 10 }) },
  { id: 'saturate', label: 'Saturation', apply: (p) => ({ ...p, isSaturated: true }) },
  { id: 'turbid', label: 'Strong turbidity', apply: (p) => ({ ...p, turbidityAU: 0.8 }) },
  { id: 'humic', label: 'Humic colour', apply: (p) => ({ ...p, colorInterferenceAU: 0.6 }) },
  { id: 'dye', label: 'Unknown dye', apply: (p) => ({ ...p, analyte: 'anomaly' }) },
];

export const applyFaults = (params: SimulationParams, faults: FaultId[]) =>
  FAULTS.filter((f) => faults.includes(f.id)).reduce((p, f) => f.apply(p), params);

// ---------------------------------------------------------------------------
// One measurement = one seeded simulation pushed through the production pipeline.
// ---------------------------------------------------------------------------

/** The twin's measurement is the shared simulation state (src/simulation/state.ts). */
export type TwinMeasurement = SimulationState;

export const measurementId = (concentration: number, run: number) =>
  `SIM-${String(Math.round(concentration * 1000)).padStart(4, '0')}-${String(run).padStart(3, '0')}`;

export function runTwinMeasurement(
  params: SimulationParams,
  deviceId: string,
  run: number,
  /** Measurement opened from the lab / a hero scenario: run 1 reproduces it exactly. */
  origin?: { seed: string; id?: string }
): TwinMeasurement {
  // Seed depends on the run only, so moving a slider changes the chemistry,
  // not the noise realisation — comparisons stay apples to apples.
  // Lead is declared as lead; an unknown dye is run as the operator would —
  // as a phosphate test, which OOD has to catch (see declaredAnalyteOf).
  return runSimulation({
    ...params,
    seed: origin ? (run === 1 ? origin.seed : `${origin.seed}-R${run}`) : `LISA-TWIN-${run}`,
    deviceId,
    declaredAnalyteId: chemistryOf(params.analyte).analyteId,
    id: origin && run === 1 ? (origin.id ?? `SIM-${origin.seed}`) : measurementId(params.concentration, run),
  });
}
