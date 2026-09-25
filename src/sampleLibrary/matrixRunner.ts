// LISA: Field Stress Matrix Runner
// Systematically stresses a single baseline water sample across noise, turbidity,
// optical slit shift, and device profile variations (up to 144 physical combinations).

import { MatrixStressResult, MatrixCellResult } from './types';
import { simulateSpectrum } from '../engine/simulator';
import { executeLISAPipeline } from '../engine/orchestrator';
import { SeededPRNG } from '../engine/prng';
import { DEMO_DEVICES } from '../engine/deviceCalibration';

export interface StressMatrixConfig {
  baseConcentration?: number; // default 0.40 mg P/L
  noiseLevels?: number[];     // e.g. [0.015, 0.04, 0.09]
  turbidityLevels?: number[]; // e.g. [0.0, 0.15, 0.40]
  shiftLevels?: number[];     // e.g. [0, 3, 6, 8]
  deviceIds?: string[];       // e.g. ['device-a-reference', 'device-b-warm', 'device-c-cool', 'device-d-budget']
}

export function runStressMatrix(config?: StressMatrixConfig): MatrixStressResult {
  const baseConc = config?.baseConcentration ?? 0.40;
  const noiseLevels = config?.noiseLevels ?? [0.015, 0.04, 0.08];
  const turbidityLevels = config?.turbidityLevels ?? [0.0, 0.15, 0.38];
  const shiftLevels = config?.shiftLevels ?? [0, 3, 6, 8];
  const deviceIds = config?.deviceIds ?? ['device-a-reference', 'device-b-warm', 'device-c-cool', 'device-d-budget'];

  const cells: MatrixCellResult[] = [];
  let sumAbsError = 0;
  let validErrCount = 0;
  let maxError = 0;
  let rejectedCount = 0;

  let comboIndex = 0;
  for (const devId of deviceIds) {
    const dev = DEMO_DEVICES.find((d) => d.id === devId) || DEMO_DEVICES[0];

    for (const noise of noiseLevels) {
      for (const turb of turbidityLevels) {
        for (const shift of shiftLevels) {
          comboIndex++;
          const prng = new SeededPRNG(`LISA-MATRIX-${comboIndex}`);

          // 1. Simulate optical spectrum under these stress conditions
          const sim = simulateSpectrum(
            {
              analyte: 'phosphate',
              concentration: baseConc,
              noiseLevel: noise,
              illuminationDrift: 0.0,
              shiftPx: shift,
              isSaturated: false,
              turbidityAU: turb,
              colorInterferenceAU: 0.0,
              deviceProfileId: dev.id,
            },
            prng
          );

          // 2. Run production orchestrator
          const result = executeLISAPipeline({
            sampleName: `Stress ${devId} N:${noise} T:${turb} S:${shift}`,
            sourceMode: 'SIMULATED',
            analyteId: 'phosphate',
            deviceId: dev.id,
            deviceFingerprint: dev.fingerprint,
            deviceProfile: dev,
            rawSampleIntensities: sim.sampleIntensities,
            rawBlankIntensities: sim.blankIntensities,
          });

          const rec = result.record;
          let absErr: number | null = null;
          let relErr: number | null = null;

          if (rec.concentration !== null) {
            absErr = Math.abs(rec.concentration - baseConc);
            relErr = (absErr / baseConc) * 100;
            sumAbsError += absErr;
            validErrCount++;
            if (absErr > maxError) maxError = absErr;
          }

          if (rec.isRejected) {
            rejectedCount++;
          }

          cells.push({
            noiseLevel: noise,
            turbidityAU: turb,
            shiftPx: shift,
            deviceId: dev.id,
            predictedConcentration: rec.concentration !== null ? Math.round(rec.concentration * 1000) / 1000 : null,
            uncertainty: rec.uncertainty !== null ? Math.round(rec.uncertainty * 1000) / 1000 : null,
            absoluteError: absErr !== null ? Math.round(absErr * 1000) / 1000 : null,
            relativeErrorPercent: relErr !== null ? Math.round(relErr * 10) / 10 : null,
            qcStatus: result.qc.overallStatus,
            oodStatus: result.ood.status,
            isRejected: rec.isRejected,
          });
        }
      }
    }
  }

  const meanAbsoluteError = validErrCount > 0 ? sumAbsError / validErrCount : 0;
  const rejectionRate = (rejectedCount / cells.length) * 100;

  return {
    baseSampleId: 'scen-ag-runoff',
    baseGroundTruth: baseConc,
    totalCombinations: cells.length,
    successfulEvaluations: validErrCount,
    rejectionRate: Math.round(rejectionRate * 10) / 10,
    meanAbsoluteError: Math.round(meanAbsoluteError * 1000) / 1000,
    maxError: Math.round(maxError * 1000) / 1000,
    cells,
  };
}
