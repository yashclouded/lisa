// LISA Digital Twin — display helpers shared by the twin page and the
// hardware viewer. Pure reads of a TwinMeasurement; no chemistry here.

import { computeAbsorbance } from '../engine/absorbance';
import { DEMO_DEVICES } from '../engine/deviceCalibration';
import { ANALYTE_REGISTRY } from '../data/analytes';
import type { PartId } from './TwinScene';
import {
  TwinMeasurement,
  chemistryOf,
  diffractionAngle,
  SENSOR_CALIBRATION,
  GRATING_LINES_PER_MM,
  WEDGE_ANGLE_RAD,
} from './twinModel';

export const deg = (rad: number) => ((rad * 180) / Math.PI).toFixed(1);
export const fmt = (v: number | null | undefined, d = 3) => (v == null ? '—' : v.toFixed(d));

export const MODEL_NAME = { ridge: 'Full-spectrum Ridge', 'beer-lambert': 'Beer–Lambert band', none: 'None' } as const;

/** The analyte the pipeline was asked to measure (not necessarily what is in the cuvette). */
export const analyteOf = (m: TwinMeasurement) =>
  ANALYTE_REGISTRY.find((a) => a.id === chemistryOf(m.params.analyte).analyteId)!;

/** Nearest 2 nm grid index to the analyte's peak. */
export const peakIndex = (m: TwinMeasurement) => Math.round((analyteOf(m).peakWavelength - 400) / 2);

/** True when the pipeline refused before processing (uncalibrated analyte). */
export const isRefused = (m: TwinMeasurement) => m.result.record.status === 'UNSUPPORTED_ANALYTE';

/**
 * Absorbance to plot. When the pipeline refuses an uncalibrated analyte it
 * returns zeros, so the twin shows the raw −log₁₀(I/I₀) from the production
 * computeAbsorbance instead — labelled as such wherever it is drawn.
 */
export const displayAbsorbance = (m: TwinMeasurement) =>
  isRefused(m) ? computeAbsorbance(m.sim.sampleIntensities, m.sim.blankIntensities) : m.result.absorbances;

const CONTENT: Record<string, (c: number) => string> = {
  phosphate: (c) => `Simulated truth: ${c.toFixed(2)} mg P/L as the molybdenum-blue complex.`,
  lead: (c) =>
    `Simulated truth: ${c.toFixed(3)} mg Pb/L as the dithizone complex (λmax ≈ 520 nm). Simulated Lead calibration.`,
  anomaly: () => 'Simulated content: yellow azo dye (peak 426 nm) — not a calibrated chemistry.',
};

export function partInfo(id: PartId, m: TwinMeasurement): { short: string; details: string[] } {
  const device = DEMO_DEVICES.find((d) => d.id === m.deviceId)!;
  const pk = peakIndex(m);
  switch (id) {
    case 'led':
      return {
        short: 'Provides controlled, broadband illumination.',
        details: [
          'Simulated as a phosphor white LED: 450 nm GaN pump + broad 565 / 625 nm phosphor bands (engine/simulator.ts).',
          'The same LED lights blank and sample, so its spectrum cancels in I / I₀.',
        ],
      };
    case 'diffuser':
      return {
        short: 'Spreads the LED evenly across the cuvette window.',
        details: ['Not modelled numerically — the simulator assumes uniform illumination.'],
      };
    case 'cuvette':
      return {
        short: 'Contains the reagent-treated sample. Path length 10 mm.',
        details: [
          (CONTENT[m.params.analyte] ?? CONTENT.anomaly)(m.params.concentration),
          `Absorbance at ${400 + 2 * pk} nm: ${fmt(displayAbsorbance(m)[pk])} AU${isRefused(m) ? ' (raw, pipeline refused)' : ''}.`,
          'Liquid colour is the simulated transmitted light; its depth is exaggerated for visibility.',
        ],
      };
    case 'slit':
      return {
        short: 'Narrows the light into a line so each wavelength maps to one sensor column.',
        details: [
          'Two razor blades 0.1–0.2 mm apart (drawn ×2 wider).',
          'Slit width sets spectral resolution; the simulator uses a fixed 2 nm grid instead of modelling it.',
        ],
      };
    case 'grating':
      return {
        short: 'Separates wavelengths spatially.',
        details: [
          `${GRATING_LINES_PER_MM} lines/mm film on the lens. sin θ = λ/d − sin α₀, α₀ = ${deg(WEDGE_ANGLE_RAD)}°.`,
          `450 nm → ${deg(diffractionAngle(450))}°, 550 nm → 0.0°, 650 nm → +${deg(diffractionAngle(650))}° from the camera axis.`,
        ],
      };
    case 'sensor':
      return {
        short: 'Records the dispersed light as a row of pixel intensities.',
        details: [
          'Pinhole-equivalent image plane: x = f · tan θ. Drawn at the lens focal distance.',
          `λ(p) = ${SENSOR_CALIBRATION.slope.toFixed(4)}·p + ${SENSOR_CALIBRATION.intercept.toFixed(1)} nm, fitted by the production calibration (residual ${SENSOR_CALIBRATION.residualRms} nm).`,
          `Peak sample count ${Math.max(...m.sim.sampleIntensities).toFixed(0)} / 255.`,
        ],
      };
    case 'phone':
      return {
        short: 'Measures the dispersed signal and runs LISA on-device.',
        details: [
          `Handset profile: ${device.name}.`,
          device.isCalibrated
            ? 'Calibrated — its spectral response is normalised before inference.'
            : 'Not calibrated — no response normalisation is applied, so its colour bias reaches the model.',
        ],
      };
    default:
      return {
        short: 'Light-tight folded card body that keeps ambient light off the sensor.',
        details: [
          '300 gsm matte-black card: 14 mm cuvette chamber, 30 × 30 mm tube, 33.4° wedge to the phone.',
          'Stray light is not modelled.',
        ],
      };
  }
}
