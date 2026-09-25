// LISA: Dedicated Failure Scenario Validator
// Rigorously compares ACTUAL production engine outputs vs EXPECTED failure behaviors
// across sensor saturation, low light throughput, mechanical cuvette shift,
// out-of-distribution dyes, high turbidity, out-of-range concentrations, and uncalibrated analytes.

import { SAMPLE_SCENARIOS } from './scenarios';
import { runSampleScenario } from './runner';

export interface FailureValidationItem {
  id: string;
  name: string;
  failureCategory: string;
  expectedBehaviorDescription: string;
  actualOutcomeDescription: string;
  isPassed: boolean;
  actualRejected: boolean;
  expectedRejected: boolean;
  qcStatus: string;
  oodStatus: string;
  rejectionReason?: string;
  details: string[];
}

export interface FailureLibraryReport {
  timestamp: string;
  totalFailureScenarios: number;
  passedCount: number;
  failedCount: number;
  scenarios: FailureValidationItem[];
}

export function validateFailureLibrary(): FailureLibraryReport {
  // Filter scenarios designated as hardware fault, adversarial, or with shouldReject
  const failureScenarios = SAMPLE_SCENARIOS.filter(
    (s) => s.category === 'hardware_fault' || s.category === 'adversarial' || s.expected.shouldReject
  );

  const scenarioReports: FailureValidationItem[] = [];
  let passedCount = 0;
  let failedCount = 0;

  for (const sc of failureScenarios) {
    const { runResult, pipelineResult } = runSampleScenario(sc);
    const details: string[] = [];

    let isPassed = false;

    // Check 1: Rejection alignment
    const rejectionMatched = runResult.isRejected === sc.expected.shouldReject;
    details.push(`Rejection match: actual=${runResult.isRejected}, expected=${sc.expected.shouldReject}`);

    // Check 2: Specific check triggers
    let triggerMatched = true;

    if (sc.id === 'scen-saturated-sensor') {
      const satFail = pipelineResult.qc.saturationCheck.status === 'FAIL';
      triggerMatched = satFail;
      details.push(`Saturation QC tier: ${pipelineResult.qc.saturationCheck.status} (expected FAIL)`);
    } else if (sc.id === 'scen-dim-light') {
      const sigFail = pipelineResult.qc.signalStrengthCheck.status === 'FAIL';
      triggerMatched = sigFail;
      details.push(`Signal strength QC tier: ${pipelineResult.qc.signalStrengthCheck.status} (expected FAIL)`);
    } else if (sc.id === 'scen-misaligned-cuvette') {
      const shiftFail = pipelineResult.qc.spectralShiftCheck.status === 'FAIL';
      triggerMatched = shiftFail;
      details.push(`Spectral shift QC tier: ${pipelineResult.qc.spectralShiftCheck.status} (expected FAIL, detected shift: ${pipelineResult.shiftPx}px)`);
    } else if (sc.id === 'scen-unknown-dye') {
      const oodTriggered = pipelineResult.ood.status === 'OUT_OF_DISTRIBUTION';
      triggerMatched = oodTriggered;
      details.push(`OOD status: ${pipelineResult.ood.status}, score=${pipelineResult.ood.score} (expected OUT_OF_DISTRIBUTION)`);
    } else if (sc.id === 'scen-uncalibrated-lead' || sc.id === 'scen-uncalibrated-metal') {
      const isRefused = runResult.isRejected && (runResult.rejectionReason?.includes('uncalibrated') ?? false);
      triggerMatched = isRefused;
      details.push(`Analyte dispatch refusal: isRefused=${isRefused}`);
    }

    isPassed = rejectionMatched && triggerMatched;
    if (isPassed) {
      passedCount++;
    } else {
      failedCount++;
    }

    scenarioReports.push({
      id: sc.id,
      name: sc.name,
      failureCategory: sc.category,
      expectedBehaviorDescription: `Should reject: ${sc.expected.shouldReject}, Expected QC: ${sc.expected.qc}, Expected OOD: ${sc.expected.ood}`,
      actualOutcomeDescription: `Actual rejected: ${runResult.isRejected}, Actual QC: ${runResult.qcStatus}, Actual OOD: ${runResult.oodStatus}`,
      isPassed,
      actualRejected: runResult.isRejected,
      expectedRejected: sc.expected.shouldReject,
      qcStatus: runResult.qcStatus,
      oodStatus: runResult.oodStatus,
      rejectionReason: runResult.rejectionReason,
      details,
    });
  }

  return {
    timestamp: new Date().toISOString(),
    totalFailureScenarios: failureScenarios.length,
    passedCount,
    failedCount,
    scenarios: scenarioReports,
  };
}
