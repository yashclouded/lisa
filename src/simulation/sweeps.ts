// LISA simulation — parameter sweeps. Every point is `reps` full pipeline runs
// with different seeds; the curves are statistics of real pipeline outputs.

import { runSimulation, SimulationConfig } from './state';
import type { InterferentKind } from '../engine/simulator';

export type SweepKey =
  | 'concentration'
  | 'noiseLevel'
  | 'turbidityAU'
  | 'reactionTimeMin'
  | 'ambientLightCounts'
  | 'exposure'
  | 'pathLengthCm'
  | 'deviceId';

export const SWEEPS: { key: SweepKey; label: string; unit: string; values: (number | string)[] }[] = [
  { key: 'concentration', label: 'Concentration', unit: 'mg/L', values: [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0] },
  { key: 'noiseLevel', label: 'Detector noise', unit: '', values: [0, 0.02, 0.05, 0.1, 0.15, 0.2, 0.3] },
  { key: 'turbidityAU', label: 'Turbidity', unit: 'AU', values: [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.6, 0.8] },
  { key: 'reactionTimeMin', label: 'Reaction time', unit: 'min', values: [0.5, 1, 2, 3, 5, 7, 10, 15, 20] },
  { key: 'ambientLightCounts', label: 'Light leak', unit: 'counts', values: [0, 2, 5, 10, 15, 20, 30] },
  { key: 'exposure', label: 'Exposure', unit: '×', values: [0.1, 0.15, 0.2, 0.3, 0.5, 0.75, 1, 1.1, 1.2, 1.3, 1.5] },
  { key: 'pathLengthCm', label: 'Path length', unit: 'cm', values: [0.25, 0.5, 0.75, 1, 1.5, 2] },
  { key: 'deviceId', label: 'Handset', unit: '', values: ['device-a-reference', 'device-b-warm', 'device-c-cool', 'device-d-budget'] },
];

export interface SweepPoint {
  x: number | string;
  truth: number | null;
  meanPredicted: number | null; // over accepted runs
  sdPredicted: number | null;
  meanAbsError: number | null;
  meanUncertainty: number | null;
  /** Fraction of accepted runs whose ± interval contains the simulated truth. */
  coverage: number | null;
  rejectedFraction: number;
  runs: number;
}

const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

export function runSweep(base: SimulationConfig, key: SweepKey, values: (number | string)[], reps = 6): SweepPoint[] {
  return values.map((x) => {
    const outs = Array.from({ length: reps }, (_, k) =>
      runSimulation({ ...base, [key]: x, seed: `${base.seed}-SWEEP-${k}`, id: undefined })
    );
    const ok = outs.filter((s) => !s.result.record.isRejected);
    const preds = ok.map((s) => s.result.record.concentration!);
    const m = mean(preds);
    const truth = outs[0].truth;
    return {
      x,
      truth,
      meanPredicted: m,
      sdPredicted: m == null || preds.length < 2 ? null : Math.sqrt(preds.reduce((a, p) => a + (p - m) ** 2, 0) / (preds.length - 1)),
      meanAbsError: truth == null ? null : mean(preds.map((p) => Math.abs(p - truth))),
      meanUncertainty: mean(ok.map((s) => s.result.record.uncertainty ?? 0)),
      coverage:
        truth == null || !ok.length
          ? null
          : ok.filter((s) => Math.abs(s.result.record.concentration! - truth) <= (s.result.record.uncertainty ?? 0)).length / ok.length,
      rejectedFraction: (outs.length - ok.length) / outs.length,
      runs: outs.length,
    };
  });
}

export const INTERFERENT_KINDS: InterferentKind[] = ['tartrazine', 'chlorophyll', 'red_dye', 'humic'];
