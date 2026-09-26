// LISA simulation — one simulated measurement, one source of truth.
//
// A SimulationConfig (chemistry + optics + sensor + environment + seed) goes
// through the production simulator and then the unchanged production pipeline.
// The resulting SimulationState is what every view reads: the 3D twin, the
// sensor strip, the spectra, QC/OOD, the result card, sweeps and cinematic mode.
// Nothing downstream recomputes chemistry or concentration.

import { simulateSpectrum, SimulationParams, reactionProgress } from '../engine/simulator';
import { executeLISAPipeline, PipelineExecutionResult } from '../engine/orchestrator';
import { SeededPRNG } from '../engine/prng';
import { DEMO_DEVICES } from '../engine/deviceCalibration';
import { ANALYTE_REGISTRY } from '../data/analytes';
import type { AnalyteDefinition } from '../types';

export const SIMULATION_CONFIG_VERSION = 'lisa-sim-2.0';

export interface SimulationConfig extends SimulationParams {
  seed: string;
  deviceId: string;
  /** What the operator asked LISA to measure. Default: the cuvette chemistry ('anomaly' → a phosphate test). */
  declaredAnalyteId?: string;
  /** Override the handset's calibration flag (device normalisation on/off). */
  deviceCalibrated?: boolean;
  id?: string;
}

export interface SimulationState {
  id: string;
  seed: string;
  deviceId: string;
  config: SimulationConfig;
  /** Exactly what was passed to the production simulator. */
  params: SimulationParams;
  sim: ReturnType<typeof simulateSpectrum>;
  result: PipelineExecutionResult;
  analyte: AnalyteDefinition;
  /** Simulated concentration of the declared analyte, or null when the cuvette holds something else. */
  truth: number | null;
  provenance: { kind: 'SIMULATED'; seed: string; configVersion: string; note: string };
}

export const declaredAnalyteOf = (c: Pick<SimulationConfig, 'analyte' | 'declaredAnalyteId'>) =>
  c.declaredAnalyteId ?? (c.analyte === 'anomaly' ? 'phosphate' : c.analyte);

const cache = new Map<string, SimulationState>();

export function runSimulation(config: SimulationConfig): SimulationState {
  const key = JSON.stringify(config);
  const hit = cache.get(key);
  if (hit) return hit;

  const profile = DEMO_DEVICES.find((d) => d.id === config.deviceId) ?? DEMO_DEVICES[0];
  const device = { ...profile, isCalibrated: config.deviceCalibrated ?? profile.isCalibrated };
  const { seed, deviceId: _d, declaredAnalyteId: _a, id: _i, deviceCalibrated: _c, ...rest } = config;
  const params: SimulationParams = { ...rest, deviceProfileId: device.id };
  const sim = simulateSpectrum(params, new SeededPRNG(seed));
  const declared = declaredAnalyteOf(config);
  const truth = config.analyte === declared ? config.concentration : null;
  const id = config.id ?? `SIM-${seed}`;

  const result = executeLISAPipeline({
    sampleName: id,
    sourceMode: 'SIMULATED',
    analyteId: declared,
    deviceId: device.id,
    deviceFingerprint: device.fingerprint,
    deviceProfile: device,
    rawSampleIntensities: sim.sampleIntensities,
    rawBlankIntensities: sim.blankIntensities,
    groundTruth: truth ?? undefined, // only used to report % error, never for inference
    notes: 'Simulated measurement (physically grounded simulation), not an experimental result.',
  });

  const state: SimulationState = {
    id,
    seed,
    deviceId: device.id,
    config,
    params,
    sim,
    result,
    analyte: ANALYTE_REGISTRY.find((a) => a.id === declared) ?? ANALYTE_REGISTRY[0],
    truth,
    provenance: {
      kind: 'SIMULATED',
      seed,
      configVersion: SIMULATION_CONFIG_VERSION,
      note: 'Synthetic optical measurement from the LISA simulator; not experimental data.',
    },
  };
  // ponytail: unbounded-ish memo, cleared wholesale; an LRU if sweeps ever get large
  if (cache.size > 400) cache.clear();
  cache.set(key, state);
  return state;
}

/** Plain, deterministic summary (no timestamps / record ids) for tests, exports and sweeps. */
export function summarize(s: SimulationState) {
  const r = s.result;
  const rec = r.record;
  const round = (v: number | null | undefined, d = 4) => (v == null ? null : +v.toFixed(d));
  return {
    id: s.id,
    seed: s.seed,
    provenance: s.provenance.kind,
    declaredAnalyte: s.analyte.id,
    truth: s.truth,
    reactionProgress: round(reactionProgress(s.params.analyte, s.params.reactionTimeMin), 3),
    predicted: rec.concentration,
    uncertainty: rec.uncertainty,
    unit: rec.unit,
    beerLambert: round(r.beerConcentration),
    ridge: round(r.ridgeConcentration),
    selectedModel: rec.selectedModel,
    qc: r.qc.overallStatus,
    ood: r.ood.status,
    oodScore: r.ood.score,
    detectedShiftPx: r.shiftPx,
    peakCounts: round(Math.max(...r.alignedProfile), 1),
    verdict: rec.verdict,
    rejected: rec.isRejected,
    rejectionReason: rec.rejectionReason ?? null,
  };
}
