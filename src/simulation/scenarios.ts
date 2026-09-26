// LISA simulation — deterministic hero scenarios and parameter presets.
// Each scenario is only a SimulationConfig + a story. The numbers the story
// quotes are computed at run time by runSimulation(); nothing here is a result.

import type { SimulationConfig } from './state';

export const BASE_CONFIG: SimulationConfig = {
  analyte: 'phosphate',
  concentration: 0.4,
  noiseLevel: 0.015,
  illuminationDrift: 0,
  shiftPx: 0,
  isSaturated: false,
  turbidityAU: 0,
  colorInterferenceAU: 0,
  pathLengthCm: 1,
  exposure: 1,
  ambientLightCounts: 0,
  sourceDrift: 0,
  interferents: [],
  seed: 'LISA-SIM-1',
  deviceId: 'device-a-reference',
};

export interface HeroScenario {
  id: string;
  label: string;
  /** What this scenario is meant to show. The outcome itself is computed, not scripted. */
  story: string;
  config: SimulationConfig;
}

const hero = (id: string, label: string, story: string, over: Partial<SimulationConfig>): HeroScenario => ({
  id,
  label,
  story,
  config: { ...BASE_CONFIG, seed: id, id, ...over },
});

export const HERO_SCENARIOS: HeroScenario[] = [
  hero('HERO_PHOSPHATE', 'Phosphate 0.40', 'Clean molybdenum-blue sample on the reference handset: the baseline everything else is compared with.', {}),
  hero('HERO_LEAD', 'Lead 0.50', 'Pb–dithizone (λmax 520 nm) through the simulated lead calibration. Research mode, not a validated assay.', {
    analyte: 'lead',
    concentration: 0.5,
  }),
  hero('HERO_UNKNOWN', 'Unknown dye', 'A tartrazine-like dye in a phosphate test. OOD has to notice the spectrum does not look like molybdenum blue.', {
    concentration: 0.1,
    interferents: [{ kind: 'tartrazine', peakAU: 1.0 }],
  }),
  hero('HERO_TURBID', 'Turbid water', 'Suspended particles scatter light (∝ λ⁻¹). QC flags the raised blue baseline; the estimate is biased low.', {
    turbidityAU: 0.3,
  }),
  hero('HERO_SATURATED', 'Over-exposed', 'Exposure 1.5× pushes the LED peak past 255 counts. The sensor clips and QC rejects.', { exposure: 1.5 }),
  hero('HERO_MISALIGNED', 'Misaligned cuvette', 'Cuvette seated 8 bins (16 nm) off axis — beyond the ±6 px alignment tolerance.', { shiftPx: 8 }),
  hero('HERO_DEVICE_MISMATCH', 'Budget phone', 'Uncalibrated budget handset: different spectral response, registration offset and extra read noise.', {
    deviceId: 'device-d-budget',
  }),
  hero('HERO_STRAY_LIGHT', 'Light leak', 'Room light leaking into the enclosure adds unattenuated counts, compressing absorbance. A known blind spot of QC.', {
    ambientLightCounts: 12,
  }),
  hero('HERO_EARLY_READ', 'Read too early', 'Captured 2 min after reagent addition: the blue has not finished developing, so the reading is low.', {
    reactionTimeMin: 2,
  }),
];

export const heroById = (id: string) => HERO_SCENARIOS.find((h) => h.id === id);

/** Difficulty presets for the Simulation Lab. Only parameters with a computational effect. */
export const PRESETS: { id: string; label: string; over: Partial<SimulationConfig> }[] = [
  { id: 'clean', label: 'Clean', over: { noiseLevel: 0.005, turbidityAU: 0, ambientLightCounts: 0, sourceDrift: 0, shiftPx: 0, interferents: [], exposure: 1 } },
  { id: 'realistic', label: 'Realistic', over: { noiseLevel: 0.02, turbidityAU: 0.05, ambientLightCounts: 2, sourceDrift: 0.01, shiftPx: 2, interferents: [], exposure: 0.9 } },
  { id: 'hard', label: 'Hard', over: { noiseLevel: 0.06, turbidityAU: 0.15, ambientLightCounts: 6, sourceDrift: 0.03, shiftPx: 4, interferents: [{ kind: 'humic', peakAU: 0.1 }], exposure: 0.6 } },
  { id: 'extreme', label: 'Extreme', over: { noiseLevel: 0.15, turbidityAU: 0.4, ambientLightCounts: 15, sourceDrift: 0.06, shiftPx: 7, interferents: [{ kind: 'humic', peakAU: 0.3 }], exposure: 0.35 } },
  { id: 'unknown', label: 'Unknown', over: { noiseLevel: 0.02, interferents: [{ kind: 'tartrazine', peakAU: 1.0 }], turbidityAU: 0, shiftPx: 0, ambientLightCounts: 0, exposure: 1 } },
];
