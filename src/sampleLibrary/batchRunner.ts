// LISA: Batch Simulation & Evaluation Harness
// Runs the entire sample suite through the production pipeline and computes
// comprehensive scientific metrics: MAE, RMSE, Bias, Rejection Rate, False Acceptance,
// False Rejection, and Uncertainty coverage.

import { SampleScenario, BatchSimulationSummary, ScenarioRunResult } from './types';
import { SAMPLE_SCENARIOS } from './scenarios';
import { runSampleScenario } from './runner';

export interface BatchRunOptions {
  scenarios?: SampleScenario[];
  seedPrefix?: string;
  deviceOverride?: string;
}

/**
 * Runs batch evaluation on a suite of scenarios.
 * Returns comprehensive statistical metrics.
 */
export function runBatchSimulation(options?: BatchRunOptions): BatchSimulationSummary {
  const scenarios = options?.scenarios || SAMPLE_SCENARIOS;
  const results: ScenarioRunResult[] = [];

  let sumAbsError = 0;
  let sumSqError = 0;
  let sumBias = 0;
  let validErrorCount = 0;

  let sumUncertainty = 0;
  let uncertaintyCount = 0;

  let passedCount = 0;
  let failedCount = 0;
  let rejectedCount = 0;
  let acceptedCount = 0;
  let falseAcceptanceCount = 0;
  let falseRejectionCount = 0;

  for (let i = 0; i < scenarios.length; i++) {
    const sc = scenarios[i];
    const seed = options?.seedPrefix ? `${options.seedPrefix}-${sc.id}` : undefined;
    const { runResult } = runSampleScenario(sc, {
      seedOverride: seed,
      deviceOverride: options?.deviceOverride,
    });

    results.push(runResult);

    if (runResult.isRejected) {
      rejectedCount++;
      if (!sc.expected.shouldReject) {
        falseRejectionCount++;
      }
    } else {
      acceptedCount++;
      if (sc.expected.shouldReject) {
        falseAcceptanceCount++;
      }
    }

    if (runResult.isExpectedBehaviorMatched) {
      passedCount++;
    } else {
      failedCount++;
    }

    if (runResult.predictedConcentration !== null) {
      const err = runResult.predictedConcentration - runResult.groundTruthConcentration;
      sumAbsError += Math.abs(err);
      sumSqError += err * err;
      sumBias += err;
      validErrorCount++;
    }

    if (runResult.uncertainty !== null) {
      sumUncertainty += runResult.uncertainty;
      uncertaintyCount++;
    }
  }

  const maeMgL = validErrorCount > 0 ? sumAbsError / validErrorCount : 0;
  const rmseMgL = validErrorCount > 0 ? Math.sqrt(sumSqError / validErrorCount) : 0;
  const meanBiasMgL = validErrorCount > 0 ? sumBias / validErrorCount : 0;
  const meanUncertaintyMgL = uncertaintyCount > 0 ? sumUncertainty / uncertaintyCount : 0;
  const rejectionRatePercent = (rejectedCount / scenarios.length) * 100;

  return {
    timestamp: new Date().toISOString(),
    totalScenarios: scenarios.length,
    evaluatedRuns: results.length,
    passedCount,
    failedCount,
    rejectedCount,
    acceptedCount,
    falseAcceptanceCount,
    falseRejectionCount,
    maeMgL: Math.round(maeMgL * 1000) / 1000,
    rmseMgL: Math.round(rmseMgL * 1000) / 1000,
    meanBiasMgL: Math.round(meanBiasMgL * 1000) / 1000,
    meanUncertaintyMgL: Math.round(meanUncertaintyMgL * 1000) / 1000,
    rejectionRatePercent: Math.round(rejectionRatePercent * 10) / 10,
    details: results,
  };
}
