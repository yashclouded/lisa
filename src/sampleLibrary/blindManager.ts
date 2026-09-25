// LISA: Blind Sample Test Manager
// Selects and runs coded blind vials where ground truth is strictly concealed
// until explicitly unsealed by the operator.

import { BlindVial, ScenarioRunResult } from './types';
import { SAMPLE_SCENARIOS } from './scenarios';
import { runSampleScenario } from './runner';

export const PREDEFINED_BLIND_VIALS: BlindVial[] = [
  {
    code: 'B-01',
    displayName: 'Blind Sample #B-01',
    scenarioId: 'scen-tap-water',
    seed: 'LISA-BLIND-SEED-B01',
    hint: 'Clear water sampled from an institutional distribution network.',
    analyteId: 'phosphate',
    groundTruthConcentration: 0.03,
    toleranceMgL: 0.04,
  },
  {
    code: 'B-02',
    displayName: 'Blind Sample #B-02',
    scenarioId: 'scen-borewell-water',
    seed: 'LISA-BLIND-SEED-B02',
    hint: 'Sub-surface aquifer source extracted from semi-arid region.',
    analyteId: 'phosphate',
    groundTruthConcentration: 0.08,
    toleranceMgL: 0.04,
  },
  {
    code: 'B-03',
    displayName: 'Blind Sample #B-03',
    scenarioId: 'scen-ag-runoff',
    seed: 'LISA-BLIND-SEED-B03',
    hint: 'Furrow water collected following agricultural top-dressing application.',
    analyteId: 'phosphate',
    groundTruthConcentration: 0.40,
    toleranceMgL: 0.04,
  },
  {
    code: 'B-04',
    displayName: 'Blind Sample #B-04',
    scenarioId: 'scen-village-pond',
    seed: 'LISA-BLIND-SEED-B04',
    hint: 'Shallow village water body exhibiting mild green tint.',
    analyteId: 'phosphate',
    groundTruthConcentration: 0.45,
    toleranceMgL: 0.05,
  },
  {
    code: 'B-05',
    displayName: 'Blind Sample #B-05',
    scenarioId: 'scen-stormwater-drain',
    seed: 'LISA-BLIND-SEED-B05',
    hint: 'Conveyance canal flowing alongside residential commercial strip.',
    analyteId: 'phosphate',
    groundTruthConcentration: 0.65,
    toleranceMgL: 0.07,
  },
  {
    code: 'B-06',
    displayName: 'Blind Sample #B-06',
    scenarioId: 'scen-ro-water',
    seed: 'LISA-BLIND-SEED-B06',
    hint: 'Polished laboratory water stream passed through reverse-osmosis stage.',
    analyteId: 'phosphate',
    groundTruthConcentration: 0.005,
    toleranceMgL: 0.03,
  },
  {
    code: 'B-07',
    displayName: 'Blind Sample #B-07',
    scenarioId: 'scen-turbid-surface',
    seed: 'LISA-BLIND-SEED-B07',
    hint: 'River water showing natural mineral clay suspension.',
    analyteId: 'phosphate',
    groundTruthConcentration: 0.35,
    toleranceMgL: 0.22,
  },
  {
    code: 'B-08',
    displayName: 'Blind Sample #B-08',
    scenarioId: 'scen-unknown-dye',
    seed: 'LISA-BLIND-SEED-B08',
    hint: 'Suspicious yellow-colored runoff sample from food processing area.',
    analyteId: 'phosphate',
    groundTruthConcentration: 0.00,
    toleranceMgL: 0.05,
  },
];

export interface BlindRunState {
  vial: BlindVial;
  runResult: ScenarioRunResult | null;
  isRevealed: boolean;
}

export function getBlindVial(codeOrIndex?: string | number): BlindVial {
  if (typeof codeOrIndex === 'number') {
    const idx = Math.abs(codeOrIndex) % PREDEFINED_BLIND_VIALS.length;
    return PREDEFINED_BLIND_VIALS[idx];
  }
  if (typeof codeOrIndex === 'string') {
    const found = PREDEFINED_BLIND_VIALS.find((v) => v.code === codeOrIndex || v.scenarioId === codeOrIndex);
    if (found) return found;
  }
  // Random selection
  const randIdx = Math.floor(Math.random() * PREDEFINED_BLIND_VIALS.length);
  return PREDEFINED_BLIND_VIALS[randIdx];
}

export function executeBlindVialTest(vial: BlindVial): ScenarioRunResult {
  const scenario = SAMPLE_SCENARIOS.find((s) => s.id === vial.scenarioId) || SAMPLE_SCENARIOS[0];
  const { runResult } = runSampleScenario(scenario, {
    seedOverride: vial.seed,
  });

  return runResult;
}
