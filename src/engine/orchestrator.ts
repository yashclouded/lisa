// LISA: Central Measurement & Inference Orchestrator
// Coordinates end-to-end signal processing, calibration, inference, QC, and explanation

import {
  MeasurementRecord,
  SourceMode,
  VerdictStatus,
  QCReport,
  OODResult,
  ModelMetrics,
  DeviceProfile,
} from '../types';
import { STANDARD_WAVELENGTHS, resampleSpectrum } from './spectrum';
import { computeCrossCorrelationAlignment } from './alignment';
import { correctBaseline } from './baseline';
import { computeAbsorbance } from './absorbance';
import { fitBeerLambertModel, predictBeerLambert, BeerLambertFit } from './beerLambert';
import { fitRidgeRegression, predictRidge, getRidgeMetrics, RidgeModel } from './ridge';
import { selectOptimalModel } from './modelSelection';
import { estimatePredictionUncertainty, computeSampleSpectralResidual } from './uncertainty';
import { runQualityControl } from './qc';
import { evaluateOOD, buildCalibrationManifold, CalibrationManifold } from './ood';
import { generateScientificExplanation } from './explanation';
import { ANALYTE_REGISTRY } from '../data/analytes';
import { generatePhosphateCalibrationStandards, generateLeadCalibrationStandards } from '../data/demoData';
import { normalizeDeviceSpectrum, DEMO_DEVICES } from './deviceCalibration';

export interface OrchestratorState {
  analyteId: string;
  calibrationStandards: any[];
  beerLambertFit: BeerLambertFit;
  ridgeModel: RidgeModel;
  manifold: CalibrationManifold;
  calibrationId: string;
  spectralSlopes: number[];
  spectralIntercepts: number[];
  bandStartNm: number;
  bandEndNm: number;
}

// Global cached calibration states keyed by analyteId ('phosphate', 'lead')
const cachedStates: Record<string, OrchestratorState> = {};

function computeSpectralSlopesAndIntercepts(standards: { concentration: number; absorbances: number[] }[]) {
  const p = STANDARD_WAVELENGTHS.length;
  const n = standards.length;
  const spectralSlopes = new Array(p).fill(0);
  const spectralIntercepts = new Array(p).fill(0);

  let sumC = 0;
  let sumCC = 0;
  for (const s of standards) {
    sumC += s.concentration;
    sumCC += s.concentration * s.concentration;
  }
  const denomC = n * sumCC - sumC * sumC;

  for (let j = 0; j < p; j++) {
    let sumA = 0;
    let sumCA = 0;
    for (const s of standards) {
      sumA += s.absorbances[j];
      sumCA += s.concentration * s.absorbances[j];
    }
    const k = Math.abs(denomC) > 1e-12 ? (n * sumCA - sumC * sumA) / denomC : 0;
    const b = (sumA - k * sumC) / n;
    spectralSlopes[j] = k;
    spectralIntercepts[j] = b;
  }

  return { spectralSlopes, spectralIntercepts };
}

export function getCalibrationForAnalyte(analyteId: string): OrchestratorState | null {
  if (cachedStates[analyteId]) return cachedStates[analyteId];

  if (analyteId === 'phosphate') {
    const standards = generatePhosphateCalibrationStandards();
    const bandStartNm = 630;
    const bandEndNm = 690;

    const beerData = standards.map((s) => ({
      concentration: s.concentration,
      absorbances: s.absorbances,
      wavelengths: s.wavelengths,
    }));
    const beerLambertFit = fitBeerLambertModel(beerData, bandStartNm, bandEndNm);

    const X = standards.map((s) => s.absorbances);
    const y = standards.map((s) => s.concentration);
    const groups = standards.map((s) => s.concentration);
    const ridgeModel = fitRidgeRegression(X, y, 0.05, true, groups);

    const manifold = buildCalibrationManifold(
      standards.map((s) => ({ concentration: s.concentration, absorbances: s.absorbances }))
    );

    const { spectralSlopes, spectralIntercepts } = computeSpectralSlopesAndIntercepts(standards);

    cachedStates[analyteId] = {
      analyteId,
      calibrationStandards: standards,
      beerLambertFit,
      ridgeModel,
      manifold,
      calibrationId: 'LISA-CAL-PHOS-V1.0',
      spectralSlopes,
      spectralIntercepts,
      bandStartNm,
      bandEndNm,
    };
    return cachedStates[analyteId];
  }

  if (analyteId === 'lead') {
    const standards = generateLeadCalibrationStandards();
    const bandStartNm = 505;
    const bandEndNm = 535;

    const beerData = standards.map((s) => ({
      concentration: s.concentration,
      absorbances: s.absorbances,
      wavelengths: s.wavelengths,
    }));
    const beerLambertFit = fitBeerLambertModel(beerData, bandStartNm, bandEndNm);

    const X = standards.map((s) => s.absorbances);
    const y = standards.map((s) => s.concentration);
    const groups = standards.map((s) => s.concentration);
    const ridgeModel = fitRidgeRegression(X, y, 0.05, true, groups);

    const manifold = buildCalibrationManifold(
      standards.map((s) => ({ concentration: s.concentration, absorbances: s.absorbances }))
    );

    const { spectralSlopes, spectralIntercepts } = computeSpectralSlopesAndIntercepts(standards);

    cachedStates[analyteId] = {
      analyteId,
      calibrationStandards: standards,
      beerLambertFit,
      ridgeModel,
      manifold,
      calibrationId: 'LISA-CAL-LEAD-SIM-V1.0',
      spectralSlopes,
      spectralIntercepts,
      bandStartNm,
      bandEndNm,
    };
    return cachedStates[analyteId];
  }

  return null;
}

export function getOrchestratorCalibration(analyteId: string = 'phosphate'): OrchestratorState {
  const cal = getCalibrationForAnalyte(analyteId);
  if (!cal) {
    throw new Error(`No calibration model available for analyte "${analyteId}".`);
  }
  return cal;
}

export interface PipelineExecutionOptions {
  sampleName: string;
  sourceMode: SourceMode;
  analyteId?: string;
  deviceId: string;
  deviceFingerprint: string;
  deviceProfile?: DeviceProfile;
  rawSampleIntensities: number[];
  rawBlankIntensities: number[];
  rawSampleWavelengths?: number[];
  sampleMatrixBlank?: number[];
  groundTruth?: number;
  notes?: string;
  isHindi?: boolean;
}

export interface PipelineExecutionResult {
  record: MeasurementRecord;
  alignedProfile: number[];
  absorbances: number[];
  baselineProfile: number[];
  shiftPx: number;
  qc: QCReport;
  ood: OODResult;
  beerMetrics: ModelMetrics;
  ridgeMetrics: ModelMetrics;
  /** Both model estimates before selection (absent when the analyte was refused). */
  beerConcentration?: number;
  ridgeConcentration?: number;
  executionTimeMs: number;
}

export function executeLISAPipeline(options: PipelineExecutionOptions): PipelineExecutionResult {
  const startTime = performance.now();

  const targetAnalyteId = options.analyteId || 'phosphate';
  const analyte = ANALYTE_REGISTRY.find((a) => a.id === targetAnalyteId);
  const cal = getCalibrationForAnalyte(targetAnalyteId);

  // Strict Analyte Dispatch:
  // If analyte is unknown or uncalibrated, refuse to report a number
  if (!analyte || !cal) {
    const analyteName = analyte?.name || targetAnalyteId;
    const rejectionReason = `LISA REFUSED TO REPORT A NUMBER: Analyte "${analyteName}" is currently uncalibrated (status: ${analyte?.status || 'unsupported'}). LISA currently supports optical inference only for calibrated analytes (Orthophosphate and simulated Lead).`;

    const executionTimeMs = parseFloat((performance.now() - startTime).toFixed(1));

    const unsupportedRecord: MeasurementRecord = {
      id: `LISA-M-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      sampleName: options.sampleName,
      analyteId: targetAnalyteId,
      analyteName: analyteName,
      sourceMode: options.sourceMode,
      deviceId: options.deviceId,
      calibrationId: 'NONE-UNCALIBRATED',
      concentration: null,
      uncertainty: null,
      unit: analyte?.unit || '',
      verdict: 'REJECTED',
      verdictLabel: 'UNSUPPORTED ANALYTE',
      qcStatus: 'FAIL',
      oodStatus: 'OUT_OF_DISTRIBUTION',
      status: 'UNSUPPORTED_ANALYTE',
      selectedModel: 'none',
      wavelengths: STANDARD_WAVELENGTHS,
      absorbances: new Array(STANDARD_WAVELENGTHS.length).fill(0),
      rawIntensities: options.rawSampleIntensities || [],
      isRejected: true,
      rejectionReason,
      explanation: {
        headline: `Measurement Rejected: ${analyteName} is Uncalibrated`,
        dominantSpectralRegion: 'N/A',
        absorbanceCharacteristic: 'N/A',
        beerLambertConsistency: 'N/A',
        oodAssessment: `Analyte "${analyteName}" has no validated calibration dataset.`,
        qcSummary: 'QC Rejection: Uncalibrated chemical parameter.',
        technicalDetails: [
          `Analyte requested: ${analyteName} (${targetAnalyteId})`,
          `Assay method: ${analyte?.assayMethod || 'Not established'}`,
          'Validated models exist only for Orthophosphate (PO₄³⁻). Cross-analyte inference is prohibited by the scientific engine.',
        ],
        simpleLanguageSummary: `LISA cannot measure ${analyteName} because its chemical calibration model is not loaded. Only phosphate testing is currently calibrated.`,
        hindiSummary: `LISA ${analyteName} का मापन नहीं कर सकता क्योंकि इसका अंशांकन मॉडल उपलब्ध नहीं है। केवल फॉस्फेट परीक्षण अंशांकित है।`,
      },
      groundTruth: options.groundTruth,
      notes: options.notes,
    };

    return {
      record: unsupportedRecord,
      alignedProfile: options.rawSampleIntensities || [],
      absorbances: new Array(STANDARD_WAVELENGTHS.length).fill(0),
      baselineProfile: new Array(STANDARD_WAVELENGTHS.length).fill(0),
      shiftPx: 0,
      qc: {
        overallStatus: 'FAIL',
        saturationCheck: {
          id: 'saturation',
          name: 'Pixel Saturation',
          status: 'FAIL',
          value: 'N/A',
          threshold: '< 245',
          detail: 'Rejected: Unsupported analyte.',
        },
        signalStrengthCheck: {
          id: 'signal',
          name: 'Signal Level',
          status: 'FAIL',
          value: 'N/A',
          threshold: '> 40',
          detail: 'Rejected: Unsupported analyte.',
        },
        spectralShiftCheck: {
          id: 'shift',
          name: 'Spectral Alignment',
          status: 'FAIL',
          value: 'N/A',
          threshold: '≤ ±6px',
          detail: 'Rejected: Unsupported analyte.',
        },
        calibrationRangeCheck: {
          id: 'range',
          name: 'Calibration Range',
          status: 'FAIL',
          value: 'N/A',
          threshold: 'N/A',
          detail: 'No calibration model available for this analyte.',
        },
        turbidityInterferenceCheck: {
          id: 'turbidity',
          name: 'Turbidity Baseline',
          status: 'FAIL',
          value: 'N/A',
          threshold: '≤ 0.12 AU',
          detail: 'Rejected: Unsupported analyte.',
        },
        canProceed: false,
        rejectionReason,
      },
      ood: {
        score: 9.99,
        status: 'OUT_OF_DISTRIBUTION',
        isAnomaly: true,
        nearestStandardConc: 0,
        detail: `Analyte "${analyteName}" is outside validated calibration space.`,
      },
      beerMetrics: {
        name: 'Beer-Lambert',
        type: 'beer-lambert',
        r2: null,
        rmse: null,
        rmseUnit: 'AU',
        concentrationRmse: null,
        loocvRmse: null,
        equationOrParams: 'Uncalibrated',
      },
      ridgeMetrics: {
        name: 'Full-Spectrum Ridge',
        type: 'ridge',
        r2: null,
        rmse: null,
        rmseUnit: analyte?.unit || '',
        loocvRmse: null,
        equationOrParams: 'Uncalibrated',
      },
      executionTimeMs,
    };
  }

  // BUG-002: Resolve active device profile and apply device normalization
  const device = options.deviceProfile ||
    DEMO_DEVICES.find((d) => d.id === options.deviceId || d.fingerprint === options.deviceFingerprint) ||
    DEMO_DEVICES[0];

  // 1. Resample to standard grid if needed
  let sampleIntensities = options.rawSampleIntensities;
  let blankIntensities = options.rawBlankIntensities;
  const targetWavelengths = STANDARD_WAVELENGTHS;

  if (options.rawSampleWavelengths && options.rawSampleWavelengths.length !== targetWavelengths.length) {
    sampleIntensities = resampleSpectrum(options.rawSampleWavelengths, sampleIntensities, targetWavelengths);
    blankIntensities = resampleSpectrum(options.rawSampleWavelengths, blankIntensities, targetWavelengths);
  }

  // BUG-002: Apply handset spectral sensitivity normalization if the device is calibrated
  if (device) {
    sampleIntensities = normalizeDeviceSpectrum(sampleIntensities, device);
  }

  // 2. Optical Cross-Correlation Alignment
  const { alignedProfile, result: alignResult } = computeCrossCorrelationAlignment(
    blankIntensities,
    sampleIntensities,
    10
  );

  // 3. Absorbance Calculation: A(lambda) = -log10(I_sample / I_blank)
  const rawAbsorbance = computeAbsorbance(alignedProfile, blankIntensities, options.sampleMatrixBlank);

  // 4. Baseline Correction (Conservative zero-offset)
  const { corrected: absorbances, baseline: baselineProfile } = correctBaseline(rawAbsorbance, 'offset-zero');

  // 5. Model Execution: Beer-Lambert Band Model
  const beerPrediction = predictBeerLambert(
    targetWavelengths,
    absorbances,
    cal.beerLambertFit,
    cal.bandStartNm,
    cal.bandEndNm
  );

  // 6. Model Execution: Full-Spectrum Ridge Model
  const ridgeConcentration = predictRidge(absorbances, cal.ridgeModel);
  const ridgeMetrics = getRidgeMetrics(cal.ridgeModel, analyte.unit);

  // 7. Objective Model Selection via LOOCV / Grouped CV
  const modelComp = selectOptimalModel(beerPrediction.metrics, ridgeMetrics);
  const selectedModel = modelComp.selectedModel;
  const rawPredictedConc = selectedModel === 'ridge' ? ridgeConcentration : beerPrediction.concentration;

  // 8. OOD Spectral Anomaly Evaluation
  const ood = evaluateOOD(absorbances, cal.manifold, analyte.name);

  // 9. Automated Multi-Tier Quality Control (QC)
  const qc = runQualityControl(
    alignedProfile,
    rawAbsorbance,
    rawPredictedConc,
    alignResult.shiftPx,
    analyte.calibrationRange,
    cal.beerLambertFit.lod ?? 0.05,
    analyte.unit
  );

  // 10. Rejection Determination
  const isRejected = !qc.canProceed || ood.isAnomaly;
  let rejectionReason: string | undefined = undefined;

  if (ood.isAnomaly) {
    rejectionReason =
      `LISA REFUSED TO REPORT A NUMBER: Sample optical signature is outside the validated ${analyte.name} calibration manifold. Laboratory verification required.`;
  } else if (!qc.canProceed) {
    rejectionReason = `LISA REFUSED TO REPORT A NUMBER: ${qc.rejectionReason || 'Quality control failure'}`;
  }

  // 11. Uncertainty Estimation (incorporating sample-specific spectral residual noise)
  const sampleNoise = computeSampleSpectralResidual(
    absorbances,
    rawPredictedConc,
    cal.spectralSlopes,
    cal.spectralIntercepts
  );

  const cvError = modelComp.selectedMetrics.groupedCvRmse ?? modelComp.selectedMetrics.loocvRmse ?? (analyte.id === 'lead' ? 0.0127 : 0.0481);
  const calRangeSpan = Math.max(1e-4, analyte.calibrationRange[1] - analyte.calibrationRange[0]);
  const isNearRangeEdge =
    rawPredictedConc < analyte.calibrationRange[0] + 0.05 * calRangeSpan ||
    rawPredictedConc > analyte.calibrationRange[1] - 0.15 * calRangeSpan;

  const uncertaintyEstimate = estimatePredictionUncertainty(
    rawPredictedConc,
    cvError,
    ood.score,
    isNearRangeEdge,
    sampleNoise.varianceConc,
    isRejected
  );

  // 12. Determine Regulatory / Indicator Verdict
  let verdict: VerdictStatus = 'SAFE';
  let verdictLabel = 'SAFE: Below Guidance Threshold';

  if (isRejected) {
    verdict = 'REJECTED';
    verdictLabel = 'MEASUREMENT REJECTED';
  } else if (rawPredictedConc > analyte.alertThreshold) {
    verdict = 'ALERT';
    verdictLabel = 'ALERT: Likely Contamination';
  } else if (rawPredictedConc >= analyte.cautionThreshold) {
    verdict = 'CAUTION';
    verdictLabel = 'CAUTION: Moderately Elevated';
  }

  // 13. Scientific Explanation
  const explanation = generateScientificExplanation({
    analyteId: analyte.id,
    analyteName: analyte.name,
    chemicalFormula: analyte.chemicalFormula,
    concentration: rawPredictedConc,
    uncertainty: uncertaintyEstimate.uncertainty ?? 0,
    unit: analyte.unit,
    verdict,
    selectedModel,
    bandStartNm: cal.bandStartNm,
    bandEndNm: cal.bandEndNm,
    calibrationRange: analyte.calibrationRange,
    qc,
    ood,
    isHindi: !!options.isHindi,
    deviceFingerprint: options.deviceFingerprint,
    isRejected,
    rejectionReason,
  });

  const finalConcentration = isRejected ? null : parseFloat(rawPredictedConc.toFixed(3));
  const finalUncertainty = isRejected ? null : uncertaintyEstimate.uncertainty;

  let percentError: number | undefined = undefined;
  if (options.groundTruth !== undefined && finalConcentration !== null && options.groundTruth > 0) {
    percentError = parseFloat(
      (Math.abs(finalConcentration - options.groundTruth) / options.groundTruth * 100).toFixed(1)
    );
  }

  const executionTimeMs = parseFloat((performance.now() - startTime).toFixed(1));

  const record: MeasurementRecord = {
    id: `LISA-M-${Date.now().toString(36).toUpperCase()}`,
    timestamp: new Date().toISOString(),
    sampleName: options.sampleName,
    analyteId: analyte.id,
    analyteName: analyte.name,
    sourceMode: options.sourceMode,
    deviceId: options.deviceId,
    calibrationId: cal.calibrationId,
    concentration: finalConcentration,
    uncertainty: finalUncertainty,
    unit: analyte.unit,
    verdict,
    verdictLabel,
    qcStatus: qc.overallStatus,
    oodStatus: ood.status,
    status: isRejected ? 'REJECTED' : 'OK',
    selectedModel,
    wavelengths: targetWavelengths,
    absorbances,
    rawIntensities: alignedProfile,
    isRejected,
    rejectionReason,
    explanation,
    groundTruth: options.groundTruth,
    percentError,
    notes: options.notes,
  };

  return {
    record,
    alignedProfile,
    absorbances,
    baselineProfile,
    shiftPx: alignResult.shiftPx,
    qc,
    ood,
    beerMetrics: beerPrediction.metrics,
    ridgeMetrics,
    beerConcentration: beerPrediction.concentration,
    ridgeConcentration,
    executionTimeMs,
  };
}
