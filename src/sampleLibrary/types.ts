// LISA: Sample Library & Field Simulation Lab Data Models
// Strict provenance and clear scientific separation between water source context
// and optical measurement inputs.

import { QCStatus, VerdictStatus, ModelMetrics, ScientificExplanation } from '../types';
import { SimulationParams } from '../engine/simulator';

export type SampleProvenance = 'SIMULATED' | 'REFERENCE_IMAGE' | 'EXPERIMENTAL';

export interface SampleScenarioGroundTruth {
  concentration: number; // mg/L
  unit: string;
}

export interface ScenarioSimulationConfig extends SimulationParams {
  seed?: string;
  interferentName?: string;
}

export interface ScenarioExpectedOutcome {
  qc: QCStatus;
  ood: 'IN_DISTRIBUTION' | 'BORDERLINE' | 'OUT_OF_DISTRIBUTION';
  shouldReject: boolean;
  expectedVerdict?: VerdictStatus;
  rejectionReasonContains?: string;
}

export interface ScenarioTolerance {
  maxAbsoluteErrorMgL: number;
  maxRelativeErrorPercent: number;
  origin: string; // Scientific justification for tolerance
}

export interface SampleSourceVisual {
  id: string;
  title: string;
  description: string;
  category: 'tap' | 'groundwater' | 'surface' | 'drain' | 'agricultural' | 'rain' | 'ro' | 'turbid' | 'adversarial' | 'industrial';
  dominantColor: string; // Ambient color for card illustration
  secondaryColor: string;
  clarity: 'crystal' | 'clear' | 'turbid' | 'opaque' | 'colored';
  svgDataUri?: string; // Bundled vector illustration
  watermark: string; // e.g. "ILLUSTRATIVE SCENARIO • CONTEXT ONLY"
}

export interface SampleScenario {
  id: string;
  name: string;
  sourceType: string;
  category: 'drinking' | 'groundwater' | 'surface' | 'effluent' | 'agricultural' | 'adversarial' | 'hardware_fault';
  description: string;
  provenance: SampleProvenance;
  provenanceDetails: string;
  analyteId: string;
  sourceVisual: SampleSourceVisual;
  groundTruth: SampleScenarioGroundTruth;
  simulation: ScenarioSimulationConfig;
  expected: ScenarioExpectedOutcome;
  tolerance?: ScenarioTolerance;
  notes?: string;
  opticalContext: {
    cuvettePathLengthCm: number;
    dispersionElement: string; // e.g. "1000 lines/mm holographic transmission grating"
    lightSource: string;       // e.g. "High-CRI phosphor white LED"
    detector: string;          // e.g. "Smartphone CMOS 400-700 nm"
  };
}

export interface ScenarioRunResult {
  scenarioId: string;
  scenarioName: string;
  provenance: SampleProvenance;
  seed: string;
  timestamp: string;
  predictedConcentration: number | null;
  uncertainty: number | null;
  unit: string;
  verdict: VerdictStatus;
  qcStatus: QCStatus;
  qcPassedChecks: number;
  qcTotalChecks: number;
  oodStatus: 'IN_DISTRIBUTION' | 'BORDERLINE' | 'OUT_OF_DISTRIBUTION';
  oodScore: number;
  isRejected: boolean;
  rejectionReason?: string;
  selectedModel: 'beer-lambert' | 'ridge' | 'none';
  beerMetrics: ModelMetrics;
  ridgeMetrics: ModelMetrics;
  wavelengths: number[];
  absorbances: number[];
  alignedProfile: number[];
  shiftPx: number;
  executionTimeMs: number;
  explanation: ScientificExplanation;

  // Validation metrics (computed against ground truth upon reveal or in batch evaluation)
  groundTruthConcentration: number;
  absoluteError: number | null;
  relativeErrorPercent: number | null;
  isAccurateWithinTolerance: boolean;
  isExpectedBehaviorMatched: boolean;
  behaviorNotes?: string;
}

export interface BatchSimulationSummary {
  timestamp: string;
  totalScenarios: number;
  evaluatedRuns: number;
  passedCount: number;
  failedCount: number;
  rejectedCount: number;
  acceptedCount: number;
  falseAcceptanceCount: number; // Anomaly was accepted
  falseRejectionCount: number;  // Valid sample was rejected
  maeMgL: number;
  rmseMgL: number;
  meanBiasMgL: number;
  meanUncertaintyMgL: number;
  rejectionRatePercent: number;
  details: ScenarioRunResult[];
}

export interface MatrixCellResult {
  noiseLevel: number;
  turbidityAU: number;
  shiftPx: number;
  deviceId: string;
  predictedConcentration: number | null;
  uncertainty: number | null;
  absoluteError: number | null;
  relativeErrorPercent: number | null;
  qcStatus: QCStatus;
  oodStatus: 'IN_DISTRIBUTION' | 'BORDERLINE' | 'OUT_OF_DISTRIBUTION';
  isRejected: boolean;
}

export interface MatrixStressResult {
  baseSampleId: string;
  baseGroundTruth: number;
  totalCombinations: number;
  successfulEvaluations: number;
  rejectionRate: number;
  meanAbsoluteError: number;
  maxError: number;
  cells: MatrixCellResult[];
}

export interface BlindVial {
  code: string;            // e.g. "BLIND-B01"
  displayName: string;     // e.g. "Blind Sample #B-01"
  scenarioId: string;
  seed: string;
  hint: string;            // Contextual clue without revealing concentration
  analyteId: string;
  groundTruthConcentration: number;
  toleranceMgL: number;
}

export interface FieldDayStop {
  stopNumber: number;
  timeLabel: string;       // e.g. "08:30"
  locationName: string;    // e.g. "Borewell A (North Pump House)"
  scenarioId: string;
  notes: string;
  targetReferenceMaxMgL: number; // e.g. 0.10 mg/L limit
}

export interface FieldDayRoute {
  id: string;
  title: string;
  date: string;
  surveyor: string;
  stops: FieldDayStop[];
}

export interface FieldDaySummary {
  routeId: string;
  totalStops: number;
  completedStops: number;
  withinReferenceRange: number;
  alertCount: number;
  rejectedCount: number;
  records: ScenarioRunResult[];
}
