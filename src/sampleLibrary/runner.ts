// LISA: Scenario Runner & Pipeline Bridge
// Executes a scenario through the identical production simulator & orchestrator.
// Guarantees zero cheating: ground truth is strictly separated from model prediction.

import { SampleScenario, ScenarioRunResult } from './types';
import { simulateSpectrum } from '../engine/simulator';
import { executeLISAPipeline, PipelineExecutionResult } from '../engine/orchestrator';
import { SeededPRNG } from '../engine/prng';
import { DEMO_DEVICES } from '../engine/deviceCalibration';

export interface RunScenarioOptions {
  seedOverride?: string;
  deviceOverride?: string;
  isHindi?: boolean;
}

/**
 * Executes a SampleScenario through the production pipeline.
 *
 * Strict scientific guarantee:
 * - Scenario configuration -> simulateSpectrum(params, prng) -> raw arrays
 * - executeLISAPipeline(raw arrays) -> mathematical inference, QC, OOD
 * - Ground truth is ONLY evaluated post-hoc for error metrics, never fed into model.
 */
export function runSampleScenario(
  scenario: SampleScenario,
  options?: RunScenarioOptions
): {
  pipelineResult: PipelineExecutionResult;
  runResult: ScenarioRunResult;
} {
  const seed = options?.seedOverride || scenario.simulation.seed || `LISA-SCEN-${scenario.id}`;
  const prng = new SeededPRNG(seed);

  // Resolve device profile
  const deviceId = options?.deviceOverride || scenario.simulation.deviceProfileId || 'device-a-reference';
  const device = DEMO_DEVICES.find((d) => d.id === deviceId) || DEMO_DEVICES[0];

  // 1. Optical physical simulation
  const sim = simulateSpectrum(
    {
      analyte: scenario.simulation.analyte,
      concentration: scenario.simulation.concentration,
      noiseLevel: scenario.simulation.noiseLevel,
      illuminationDrift: scenario.simulation.illuminationDrift,
      shiftPx: scenario.simulation.shiftPx,
      isSaturated: scenario.simulation.isSaturated,
      turbidityAU: scenario.simulation.turbidityAU,
      colorInterferenceAU: scenario.simulation.colorInterferenceAU,
      deviceProfileId: device.id,
    },
    prng
  );

  // 2. Production pipeline execution (zero shortcut, zero second engine)
  const pipelineResult = executeLISAPipeline({
    sampleName: scenario.name,
    sourceMode: 'SIMULATED',
    analyteId: scenario.analyteId,
    deviceId: device.id,
    deviceFingerprint: device.fingerprint,
    deviceProfile: device,
    rawSampleIntensities: sim.sampleIntensities,
    rawBlankIntensities: sim.blankIntensities,
    notes: `Simulated scenario: ${scenario.name} (Seed: ${seed})`,
    isHindi: options?.isHindi ?? false,
  });

  const record = pipelineResult.record;
  const groundTruthConc = scenario.groundTruth.concentration;

  // 3. Post-hoc validation calculations
  let absoluteError: number | null = null;
  let relativeErrorPercent: number | null = null;
  let isAccurateWithinTolerance = false;

  if (record.concentration !== null) {
    absoluteError = Math.abs(record.concentration - groundTruthConc);
    if (groundTruthConc > 0) {
      relativeErrorPercent = (absoluteError / groundTruthConc) * 100;
    } else {
      relativeErrorPercent = null;
    }

    if (scenario.tolerance) {
      const absOk = absoluteError <= scenario.tolerance.maxAbsoluteErrorMgL;
      const relOk = relativeErrorPercent !== null
        ? relativeErrorPercent <= scenario.tolerance.maxRelativeErrorPercent
        : true;
      isAccurateWithinTolerance = absOk || relOk;
    } else {
      isAccurateWithinTolerance = absoluteError <= 0.05;
    }
  }

  // Count passed QC tiers
  const qcChecks = [
    pipelineResult.qc.saturationCheck,
    pipelineResult.qc.signalStrengthCheck,
    pipelineResult.qc.spectralShiftCheck,
    pipelineResult.qc.calibrationRangeCheck,
    pipelineResult.qc.turbidityInterferenceCheck,
  ];
  const passedCount = qcChecks.filter((c) => c.status === 'PASS').length;

  // Verify expected behavior matching
  let isExpectedBehaviorMatched = false;
  let behaviorNotes = '';

  if (scenario.expected.shouldReject) {
    // Expected rejection: verify pipeline actually rejected
    if (record.isRejected) {
      isExpectedBehaviorMatched = true;
      behaviorNotes = 'Correctly rejected as expected.';
      if (scenario.expected.rejectionReasonContains && record.rejectionReason) {
        if (!record.rejectionReason.includes(scenario.expected.rejectionReasonContains)) {
          behaviorNotes += ` (Note: rejection reason text differed slightly: ${record.rejectionReason})`;
        }
      }
    } else {
      isExpectedBehaviorMatched = false;
      behaviorNotes = `FALSE ACCEPTANCE: Scenario was expected to be rejected, but pipeline produced concentration ${record.concentration} mg/L.`;
    }
  } else {
    // Expected valid measurement
    if (!record.isRejected) {
      isExpectedBehaviorMatched = isAccurateWithinTolerance;
      behaviorNotes = isAccurateWithinTolerance
        ? 'Accepted and predicted within tolerance.'
        : `Accepted, but prediction (${record.concentration?.toFixed(2)} mg/L) exceeded tolerance vs truth (${groundTruthConc.toFixed(2)} mg/L).`;
    } else {
      isExpectedBehaviorMatched = false;
      behaviorNotes = `FALSE REJECTION: Valid sample was rejected by pipeline (${record.rejectionReason}).`;
    }
  }

  const runResult: ScenarioRunResult = {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    provenance: scenario.provenance,
    seed,
    timestamp: record.timestamp,
    predictedConcentration: record.concentration,
    uncertainty: record.uncertainty,
    unit: record.unit,
    verdict: record.verdict,
    qcStatus: pipelineResult.qc.overallStatus,
    qcPassedChecks: passedCount,
    qcTotalChecks: qcChecks.length,
    oodStatus: pipelineResult.ood.status,
    oodScore: pipelineResult.ood.score,
    isRejected: record.isRejected,
    rejectionReason: record.rejectionReason,
    selectedModel: record.selectedModel,
    beerMetrics: pipelineResult.beerMetrics,
    ridgeMetrics: pipelineResult.ridgeMetrics,
    wavelengths: record.wavelengths,
    absorbances: record.absorbances,
    alignedProfile: pipelineResult.alignedProfile,
    shiftPx: pipelineResult.shiftPx,
    executionTimeMs: pipelineResult.executionTimeMs,
    explanation: record.explanation,
    groundTruthConcentration: groundTruthConc,
    absoluteError: absoluteError !== null ? Math.round(absoluteError * 1000) / 1000 : null,
    relativeErrorPercent: relativeErrorPercent !== null ? Math.round(relativeErrorPercent * 10) / 10 : null,
    isAccurateWithinTolerance,
    isExpectedBehaviorMatched,
    behaviorNotes,
  };

  return {
    pipelineResult,
    runResult,
  };
}
