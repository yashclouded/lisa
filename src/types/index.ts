// LISA: Light-based In-field Spectral Analyser
// Core Type Definitions

export type SourceMode = 'SIMULATED' | 'UPLOADED' | 'LIVE CAMERA' | 'HARDWARE';

export type VerdictStatus = 'SAFE' | 'CAUTION' | 'ALERT' | 'REJECTED';

export type QCStatus = 'PASS' | 'WARNING' | 'FAIL';

export interface AnalyteDefinition {
  id: string;
  name: string;
  chemicalFormula: string;
  assayMethod: string;
  unit: string;
  primaryBand: [number, number]; // [min_nm, max_nm]
  peakWavelength: number;        // nm
  calibrationRange: [number, number]; // [min, max] mg/L
  safeThreshold: number;         // mg/L
  cautionThreshold: number;      // mg/L
  alertThreshold: number;        // mg/L
  isDrinkingWaterStandard: boolean;
  standardReference: string;
  regulatoryNote: string;
  status: 'live' | 'development' | 'roadmap';
  reagents: string[];
}

export interface WavelengthFit {
  isValid: boolean;
  errorCode?: string;
  slope: number;        // nm per pixel
  intercept: number;    // nm at pixel 0
  r2: number | null;
  residualRms: number | null;  // nm
  referenceLines: { name: string; trueNm: number; pixel: number; fittedNm: number }[];
}

export interface SpectrumData {
  wavelengths: number[];   // typically 400 to 700 in 2nm steps (151 points)
  intensities: number[];   // raw transmission or relative intensity
  absorbances?: number[];  // -log10(I_sample / I_blank)
  metadata: {
    sourceMode: SourceMode;
    timestamp: string;
    exposureMs?: number;
    gain?: number;
    deviceId: string;
    sampleId?: string;
    isDarkCorrected?: boolean;
    isBlankCorrected?: boolean;
    blankType?: 'instrument' | 'sample';
  };
}

export interface AlignmentResult {
  shiftPx: number;
  correlation: number;
  aligned: boolean;
  status: QCStatus;
  message: string;
}

export interface ModelMetrics {
  name: string;
  type: 'beer-lambert' | 'ridge';
  r2: number | null;
  rmse: number | null;
  rmseUnit?: string;           // 'AU' or 'mg P/L'
  concentrationRmse?: number | null; // concentration-space calibration error (mg/L)
  mae?: number | null;
  loocvRmse: number | null;
  groupedCvRmse?: number | null;
  groupedCvMae?: number | null;
  groupedCvR2?: number | null;
  cvGroupsCount?: number;
  cvPredictionsCount?: number;
  equationOrParams?: string;
  lod?: number | null;
  loq?: number | null;
}

export interface PredictionResult {
  concentration: number;
  uncertainty: number;        // ± delta
  lowerBound: number;
  upperBound: number;
  confidenceScore: 'HIGH' | 'MODERATE' | 'LOW';
  confidencePercent: number;  // 0-100%
  selectedModel: 'beer-lambert' | 'ridge';
  beerLambertMetrics: ModelMetrics;
  ridgeMetrics: ModelMetrics;
  modelSelectionRationale: string;
}

export interface QCCheckItem {
  id: string;
  name: string;
  status: QCStatus;
  value: string | number;
  threshold: string;
  detail: string;
}

export interface QCReport {
  overallStatus: QCStatus;
  saturationCheck: QCCheckItem;
  signalStrengthCheck: QCCheckItem;
  spectralShiftCheck: QCCheckItem;
  calibrationRangeCheck: QCCheckItem;
  turbidityInterferenceCheck: QCCheckItem;
  canProceed: boolean;
  rejectionReason?: string;
}

export interface OODResult {
  score: number;              // distance score (normalized)
  status: 'IN_DISTRIBUTION' | 'BORDERLINE' | 'OUT_OF_DISTRIBUTION';
  isAnomaly: boolean;
  nearestStandardConc: number;
  detail: string;
}

export interface ScientificExplanation {
  headline: string;
  dominantSpectralRegion: string;
  absorbanceCharacteristic: string;
  beerLambertConsistency: string;
  oodAssessment: string;
  qcSummary: string;
  technicalDetails: string[];
  simpleLanguageSummary: string;
  hindiSummary: string;
}

export interface MeasurementRecord {
  id: string;
  timestamp: string;
  sampleName: string;
  analyteId: string;
  analyteName: string;
  sourceMode: SourceMode;
  deviceId: string;
  calibrationId: string;
  concentration: number | null;
  uncertainty: number | null;
  unit: string;
  verdict: VerdictStatus;
  verdictLabel: string;
  qcStatus: QCStatus;
  oodStatus: 'IN_DISTRIBUTION' | 'BORDERLINE' | 'OUT_OF_DISTRIBUTION';
  status?: string;
  selectedModel: 'beer-lambert' | 'ridge' | 'none';
  wavelengths: number[];
  absorbances: number[];
  rawIntensities: number[];
  isRejected: boolean;
  rejectionReason?: string;
  explanation: ScientificExplanation;
  groundTruth?: number;       // For blind test / validation
  percentError?: number;      // vs ground truth
  notes?: string;
}

export interface DeviceProfile {
  id: string;
  name: string;
  description: string;
  colorTemperatureBias: 'neutral' | 'warm' | 'cool' | 'budget-noisy';
  spectralSensitivity: number[]; // response curve over 400-700 nm
  noiseRms: number;
  gainDrift: number;
  wavelengthOffsetPx: number;
  fingerprint: string;
  isCalibrated: boolean;
}

export interface CalibrationStandard {
  standardId: string;
  concentration: number;       // mg P/L
  replicates: {
    replicateIndex: number;
    spectrum: number[];
    absorbance: number[];
    wavelengths: number[];
  }[];
  meanAbsorbancePeak: number;
}
