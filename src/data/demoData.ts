// LISA: Deterministic Demo Datasets
// Seeded with LISA-DEMO-2026 for rock-solid hackathon presentation reproducibility

import { STANDARD_WAVELENGTHS } from '../engine/spectrum';
import { SeededPRNG } from '../engine/prng';
import { simulateSpectrum, SimulationParams } from '../engine/simulator';
import { computeAbsorbance } from '../engine/absorbance';
import { correctBaseline } from '../engine/baseline';

export interface DemoSample {
  id: string;
  name: string;
  category: 'standard' | 'unknown' | 'adversarial' | 'real';
  analyte: 'phosphate' | 'iron' | 'lead' | 'anomaly';
  targetConcentration: number;
  description: string;
  notes?: string;
  params: SimulationParams;
  groundTruthConcentration: number;
  isAdversarial?: boolean;
  expectedBehavior: 'pass' | 'warning' | 'reject';
}

// Generate 11 simulated Lead calibration standards with 3 replicates each (33 total runs)
// Range: 0.00 to 2.00 mg Pb/L, denser low-concentration region for 0.01 mg/L IS 10500 threshold
export function generateLeadCalibrationStandards() {
  const prng = new SeededPRNG('LISA-CAL-LEAD-2026');
  const concentrations = [0.0, 0.005, 0.01, 0.02, 0.05, 0.10, 0.25, 0.50, 1.00, 1.50, 2.00];
  const standardsData: {
    concentration: number;
    replicateIndex: number;
    wavelengths: number[];
    blankIntensities: number[];
    sampleIntensities: number[];
    absorbances: number[];
    analyteId: string;
    provenance: string;
  }[] = [];

  for (const conc of concentrations) {
    for (let rep = 1; rep <= 3; rep++) {
      const sim = simulateSpectrum(
        {
          analyte: 'lead',
          concentration: conc,
          noiseLevel: 0.015,
          illuminationDrift: prng.uniform(-0.02, 0.02),
          shiftPx: Math.round(prng.uniform(-1, 1)),
          isSaturated: false,
          turbidityAU: 0.0,
          colorInterferenceAU: 0.0,
        },
        prng,
        STANDARD_WAVELENGTHS
      );

      const rawAbs = computeAbsorbance(sim.sampleIntensities, sim.blankIntensities);
      const { corrected: absorbances } = correctBaseline(rawAbs, 'offset-zero');

      standardsData.push({
        concentration: conc,
        replicateIndex: rep,
        wavelengths: STANDARD_WAVELENGTHS,
        blankIntensities: sim.blankIntensities,
        sampleIntensities: sim.sampleIntensities,
        absorbances,
        analyteId: 'lead',
        provenance: 'SIMULATED',
      });
    }
  }

  return standardsData;
}

// Generate 7 phosphate calibration standards with 3 replicates each (21 total runs)
export function generatePhosphateCalibrationStandards() {
  const prng = new SeededPRNG('LISA-DEMO-2026-CAL');
  const concentrations = [0.0, 0.1, 0.2, 0.4, 0.6, 0.8, 1.0];
  const standardsData: {
    concentration: number;
    replicateIndex: number;
    wavelengths: number[];
    blankIntensities: number[];
    sampleIntensities: number[];
    absorbances: number[];
  }[] = [];

  for (const conc of concentrations) {
    for (let rep = 1; rep <= 3; rep++) {
      const sim = simulateSpectrum(
        {
          analyte: 'phosphate',
          concentration: conc,
          noiseLevel: 0.015,
          illuminationDrift: prng.uniform(-0.02, 0.02),
          shiftPx: Math.round(prng.uniform(-1, 1)),
          isSaturated: false,
          turbidityAU: 0.0,
          colorInterferenceAU: 0.0,
        },
        prng,
        STANDARD_WAVELENGTHS
      );

      const rawAbs = computeAbsorbance(sim.sampleIntensities, sim.blankIntensities);
      const { corrected: absorbances } = correctBaseline(rawAbs, 'offset-zero');

      standardsData.push({
        concentration: conc,
        replicateIndex: rep,
        wavelengths: STANDARD_WAVELENGTHS,
        blankIntensities: sim.blankIntensities,
        sampleIntensities: sim.sampleIntensities,
        absorbances,
      });
    }
  }

  return standardsData;
}

// Curated Unknown & Adversarial Demo Samples
export const CURATED_DEMO_SAMPLES: DemoSample[] = [
  {
    id: 'sample-vial-x',
    name: 'Vial X (Ashoka Hostel Water Cooler)',
    category: 'unknown',
    analyte: 'phosphate',
    targetConcentration: 0.03,
    groundTruthConcentration: 0.03,
    description: 'Fresh filtered campus drinking water. Clean baseline, negligible background turbidity.',
    expectedBehavior: 'pass',
    params: {
      analyte: 'phosphate',
      concentration: 0.03,
      noiseLevel: 0.015,
      illuminationDrift: 0.01,
      shiftPx: 0,
      isSaturated: false,
      turbidityAU: 0.01,
      colorInterferenceAU: 0.0,
    },
  },
  {
    id: 'sample-vial-y',
    name: 'Vial Y (Spiked Agricultural Runoff)',
    category: 'unknown',
    analyte: 'phosphate',
    targetConcentration: 0.40,
    groundTruthConcentration: 0.40,
    description: 'Groundwater spiked with 0.40 mg P/L diammonium phosphate (DAP) fertilizer. Primary live blind test vial.',
    expectedBehavior: 'pass',
    notes: 'Used in live judge demonstration. Expected predict: 0.41 ± 0.02 mg P/L (<2.5% error).',
    params: {
      analyte: 'phosphate',
      concentration: 0.40,
      noiseLevel: 0.018,
      illuminationDrift: -0.01,
      shiftPx: 1,
      isSaturated: false,
      turbidityAU: 0.02,
      colorInterferenceAU: 0.0,
    },
  },
  {
    id: 'sample-vial-z',
    name: 'Vial Z (Commercial Detergent Wash)',
    category: 'unknown',
    analyte: 'phosphate',
    targetConcentration: 0.72,
    groundTruthConcentration: 0.72,
    description: 'Laundry greywater containing sodium tripolyphosphate builders. Intense blue chromophore.',
    expectedBehavior: 'pass',
    params: {
      analyte: 'phosphate',
      concentration: 0.72,
      noiseLevel: 0.02,
      illuminationDrift: 0.02,
      shiftPx: -1,
      isSaturated: false,
      turbidityAU: 0.04,
      colorInterferenceAU: 0.0,
    },
  },
  {
    id: 'sample-turbid-drain',
    name: 'Sonipat Agricultural Drain (Turbid)',
    category: 'real',
    analyte: 'phosphate',
    targetConcentration: 0.35,
    groundTruthConcentration: 0.35,
    description: 'Real field surface runoff containing suspended colloidal clay and organic matrix tint.',
    expectedBehavior: 'warning',
    params: {
      analyte: 'phosphate',
      concentration: 0.35,
      noiseLevel: 0.025,
      illuminationDrift: 0.0,
      shiftPx: 2,
      isSaturated: false,
      turbidityAU: 0.38,
      colorInterferenceAU: 0.15,
    },
  },
  {
    id: 'sample-adversarial-ood',
    name: 'Adversarial: Food Dye Contaminant (Tartrazine/Green)',
    category: 'adversarial',
    analyte: 'anomaly',
    targetConcentration: 0.0,
    groundTruthConcentration: 0.0,
    isAdversarial: true,
    description: 'Water tainted with non-phosphate synthetic colorants. Severe out-of-distribution anomaly.',
    expectedBehavior: 'reject',
    notes: 'Demonstrates LISA rejecting unvalidated optical signatures rather than guessing false numbers.',
    params: {
      analyte: 'anomaly',
      concentration: 1.0,
      noiseLevel: 0.02,
      illuminationDrift: 0.0,
      shiftPx: 0,
      isSaturated: false,
      turbidityAU: 0.0,
      colorInterferenceAU: 0.0,
    },
  },
  {
    id: 'sample-adversarial-saturated',
    name: 'Adversarial: Severe Pixel Saturation',
    category: 'adversarial',
    analyte: 'phosphate',
    targetConcentration: 0.20,
    groundTruthConcentration: 0.20,
    isAdversarial: true,
    description: 'Camera exposure accidentally set too high, clipping CMOS sensor photodiode wells (255 intensity ceiling).',
    expectedBehavior: 'reject',
    params: {
      analyte: 'phosphate',
      concentration: 0.20,
      noiseLevel: 0.01,
      illuminationDrift: 0.3,
      shiftPx: 0,
      isSaturated: true,
      turbidityAU: 0.0,
      colorInterferenceAU: 0.0,
    },
  },
  {
    id: 'sample-adversarial-shifted',
    name: 'Adversarial: Mechanical Slit Misalignment (+8px)',
    category: 'adversarial',
    analyte: 'phosphate',
    targetConcentration: 0.50,
    groundTruthConcentration: 0.50,
    isAdversarial: true,
    description: 'Cuvette improperly seated in 300 gsm paper housing, causing optical shift beyond registration limit.',
    expectedBehavior: 'warning',
    params: {
      analyte: 'phosphate',
      concentration: 0.50,
      noiseLevel: 0.02,
      illuminationDrift: 0.0,
      shiftPx: 8,
      isSaturated: false,
      turbidityAU: 0.0,
      colorInterferenceAU: 0.0,
    },
  },
  {
    id: 'sample-adversarial-overrange',
    name: 'Adversarial: Industrial Effluent (>1.8 mg/L Over-Range)',
    category: 'adversarial',
    analyte: 'phosphate',
    targetConcentration: 1.85,
    groundTruthConcentration: 1.85,
    isAdversarial: true,
    description: 'Raw sewage discharge exceeding highest standard (1.0 mg/L). Prompts 1:10 dilution recommendation.',
    expectedBehavior: 'warning',
    params: {
      analyte: 'phosphate',
      concentration: 1.85,
      noiseLevel: 0.02,
      illuminationDrift: 0.0,
      shiftPx: 0,
      isSaturated: false,
      turbidityAU: 0.05,
      colorInterferenceAU: 0.0,
    },
  },
  {
    id: 'sample-lead-001',
    name: 'Lead Reference Standard (0.01 mg Pb/L - BIS Limit)',
    category: 'standard',
    analyte: 'lead',
    targetConcentration: 0.01,
    groundTruthConcentration: 0.01,
    description: 'Simulated drinking water at the BIS IS 10500 / WHO reference limit (0.01 mg Pb/L). Near instrument LOD; issues low-concentration advisory.',
    expectedBehavior: 'warning',
    params: {
      analyte: 'lead',
      concentration: 0.01,
      noiseLevel: 0.015,
      illuminationDrift: 0.0,
      shiftPx: 0,
      isSaturated: false,
      turbidityAU: 0.0,
      colorInterferenceAU: 0.0,
    },
  },
  {
    id: 'sample-lead-010',
    name: 'Lead Standard (0.10 mg Pb/L)',
    category: 'standard',
    analyte: 'lead',
    targetConcentration: 0.10,
    groundTruthConcentration: 0.10,
    description: 'Simulated water with 0.10 mg Pb/L. Clear ~520 nm dithizonate absorption feature above baseline noise floor.',
    expectedBehavior: 'pass',
    params: {
      analyte: 'lead',
      concentration: 0.10,
      noiseLevel: 0.015,
      illuminationDrift: 0.005,
      shiftPx: 0,
      isSaturated: false,
      turbidityAU: 0.0,
      colorInterferenceAU: 0.0,
    },
  },
  {
    id: 'sample-lead-040',
    name: 'Lead Calibration Standard (0.40 mg Pb/L)',
    category: 'standard',
    analyte: 'lead',
    targetConcentration: 0.40,
    groundTruthConcentration: 0.40,
    description: 'Primary simulated demonstration standard (0.400 mg Pb/L). Prominent 520 nm pink complex absorption.',
    expectedBehavior: 'pass',
    notes: 'Primary clean test scenario: predicted concentration matches 0.40 mg Pb/L within ~1% error.',
    params: {
      analyte: 'lead',
      concentration: 0.40,
      noiseLevel: 0.015,
      illuminationDrift: 0.0,
      shiftPx: 0,
      isSaturated: false,
      turbidityAU: 0.0,
      colorInterferenceAU: 0.0,
    },
  },
  {
    id: 'sample-lead-100',
    name: 'Lead Industrial Effluent (1.00 mg Pb/L)',
    category: 'standard',
    analyte: 'lead',
    targetConcentration: 1.00,
    groundTruthConcentration: 1.00,
    description: 'Simulated industrial battery discharge containing 1.00 mg Pb/L. Strong 520 nm optical response.',
    expectedBehavior: 'pass',
    params: {
      analyte: 'lead',
      concentration: 1.00,
      noiseLevel: 0.018,
      illuminationDrift: 0.01,
      shiftPx: 0,
      isSaturated: false,
      turbidityAU: 0.01,
      colorInterferenceAU: 0.0,
    },
  },
  {
    id: 'sample-lead-150',
    name: 'Lead High Standard (1.50 mg Pb/L)',
    category: 'standard',
    analyte: 'lead',
    targetConcentration: 1.50,
    groundTruthConcentration: 1.50,
    description: 'Simulated high-range standard (1.50 mg Pb/L). Visibly pink, high optical density in 505-535 nm band.',
    expectedBehavior: 'pass',
    params: {
      analyte: 'lead',
      concentration: 1.50,
      noiseLevel: 0.02,
      illuminationDrift: -0.01,
      shiftPx: 0,
      isSaturated: false,
      turbidityAU: 0.02,
      colorInterferenceAU: 0.0,
    },
  },
  {
    id: 'sample-lead-turbid',
    name: 'Lead + Turbidity Interference (0.40 mg Pb/L)',
    category: 'real',
    analyte: 'lead',
    targetConcentration: 0.40,
    groundTruthConcentration: 0.40,
    description: 'Lead sample with colloidal scattering background (0.35 AU turbidity). QC triggers turbidity warning.',
    expectedBehavior: 'warning',
    params: {
      analyte: 'lead',
      concentration: 0.40,
      noiseLevel: 0.02,
      illuminationDrift: 0.0,
      shiftPx: 1,
      isSaturated: false,
      turbidityAU: 0.35,
      colorInterferenceAU: 0.05,
    },
  },
  {
    id: 'sample-lead-shift',
    name: 'Adversarial: Lead Slit Misalignment (+8px)',
    category: 'adversarial',
    analyte: 'lead',
    targetConcentration: 0.40,
    groundTruthConcentration: 0.40,
    isAdversarial: true,
    description: 'Cuvette mechanically displaced 8px. Spectral shift check triggers QC failure.',
    expectedBehavior: 'reject',
    params: {
      analyte: 'lead',
      concentration: 0.40,
      noiseLevel: 0.015,
      illuminationDrift: 0.0,
      shiftPx: 8,
      isSaturated: false,
      turbidityAU: 0.0,
      colorInterferenceAU: 0.0,
    },
  },
  {
    id: 'sample-lead-saturated',
    name: 'Adversarial: Lead Saturated Sensor',
    category: 'adversarial',
    analyte: 'lead',
    targetConcentration: 0.40,
    groundTruthConcentration: 0.40,
    isAdversarial: true,
    description: 'Over-exposed CMOS detector clipping at 255. QC saturation check fails.',
    expectedBehavior: 'reject',
    params: {
      analyte: 'lead',
      concentration: 0.40,
      noiseLevel: 0.01,
      illuminationDrift: 0.2,
      shiftPx: 0,
      isSaturated: true,
      turbidityAU: 0.0,
      colorInterferenceAU: 0.0,
    },
  },
  {
    id: 'sample-lead-dye',
    name: 'Adversarial: Synthetic Dye in Lead Test Mode',
    category: 'adversarial',
    analyte: 'anomaly',
    targetConcentration: 0.0,
    groundTruthConcentration: 0.0,
    isAdversarial: true,
    description: 'Water sample contaminated with yellow dye (Tartrazine 426 nm) tested as Lead. Rejected by Lead OOD manifold.',
    expectedBehavior: 'reject',
    params: {
      analyte: 'anomaly',
      concentration: 1.0,
      noiseLevel: 0.02,
      illuminationDrift: 0.0,
      shiftPx: 0,
      isSaturated: false,
      turbidityAU: 0.0,
      colorInterferenceAU: 0.0,
    },
  },
];
