import assert from 'node:assert/strict';

import { executeLISAPipeline, getOrchestratorCalibration, getCalibrationForAnalyte } from '../src/engine/orchestrator';
import { computeAbsorbance } from '../src/engine/absorbance';
import { DeviceProfile } from '../src/types';
import { STANDARD_WAVELENGTHS } from '../src/engine/spectrum';
import { normalizeDeviceSpectrum } from '../src/engine/deviceCalibration';
import { fitWavelengthCalibration } from '../src/engine/wavelength';
import { fitBeerLambertModel, predictBeerLambert } from '../src/engine/beerLambert';
import { fitRidgeRegression } from '../src/engine/ridge';
import { computeVarianceCentroid } from '../src/adapters/imageRoi';
import { CameraAdapter } from '../src/adapters/camera';
import { loadHistory, saveHistory, HISTORY_STORAGE_KEY } from '../src/engine/historyStorage';
import { simulateSpectrum } from '../src/engine/simulator';
import { LAB_BENCHMARK_SERIES } from '../src/data/labBenchmark';
import { generatePhosphateCalibrationStandards, CURATED_DEMO_SAMPLES } from '../src/data/demoData';

const PHOSPHATE_CALIBRATION_STANDARDS = generatePhosphateCalibrationStandards();

let passCount = 0;
let failCount = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passCount++;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    failCount++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('============================================================');
console.log('LISA SCIENTIFIC & ML COMPREHENSIVE VERIFICATION SUITE');
console.log('============================================================\n');

// -------------------------------------------------------------
// BUG-001: Analyte Dispatch
// -------------------------------------------------------------
console.log('PHASE 1: BUG-001 Analyte Dispatch & Protection');
test('phosphate executes using validated phosphate calibration', () => {
  const sim = simulateSpectrum({ analyte: 'phosphate', concentration: 0.40 });
  const res = executeLISAPipeline({
    sampleName: 'Phosphate Valid Standard',
    sourceMode: 'SIMULATED',
    analyteId: 'phosphate',
    rawSampleIntensities: sim.sampleIntensities,
    rawBlankIntensities: sim.blankIntensities,
    groundTruth: 0.40,
  });
  assert.strictEqual(res.record.analyteId, 'phosphate');
  assert.strictEqual(res.record.isRejected, false);
  assert.ok(typeof res.record.concentration === 'number' && res.record.concentration > 0);
  assert.ok(res.record.selectedModel === 'beer-lambert' || res.record.selectedModel === 'ridge');
});

test('lead executes using simulated lead calibration', () => {
  const sim = simulateSpectrum({ analyte: 'lead', concentration: 0.40 });
  const res = executeLISAPipeline({
    sampleName: 'Lead Valid Standard',
    sourceMode: 'SIMULATED',
    analyteId: 'lead',
    rawSampleIntensities: sim.sampleIntensities,
    rawBlankIntensities: sim.blankIntensities,
    groundTruth: 0.40,
  });
  assert.strictEqual(res.record.analyteId, 'lead');
  assert.strictEqual(res.record.unit, 'mg Pb/L');
  assert.strictEqual(res.record.isRejected, false);
  assert.ok(typeof res.record.concentration === 'number' && Math.abs(res.record.concentration - 0.40) < 0.03);
  assert.ok(res.record.selectedModel === 'beer-lambert' || res.record.selectedModel === 'ridge');
});

test('iron is rejected without executing models', () => {
  const sim = simulateSpectrum({ analyte: 'iron', concentration: 0.50 });
  const res = executeLISAPipeline({
    sampleName: 'Iron Test',
    sourceMode: 'SIMULATED',
    analyteId: 'iron',
    rawSampleIntensities: sim.sampleIntensities,
    rawBlankIntensities: sim.blankIntensities,
  });
  assert.strictEqual(res.record.analyteId, 'iron');
  assert.strictEqual(res.record.isRejected, true);
  assert.strictEqual(res.record.concentration, null);
  assert.strictEqual(res.record.uncertainty, null);
  assert.strictEqual(res.record.selectedModel, 'none');
  assert.strictEqual(res.record.status, 'UNSUPPORTED_ANALYTE');
});

test('fluoride, nitrate, and unknown analytes are all rejected', () => {
  for (const analyte of ['fluoride', 'nitrate', 'arsenic-unknown']) {
    const res = executeLISAPipeline({
      sampleName: `${analyte} test`,
      sourceMode: 'SIMULATED',
      analyteId: analyte,
      rawSampleIntensities: new Array(151).fill(100),
      rawBlankIntensities: new Array(151).fill(200),
    });
    assert.strictEqual(res.record.isRejected, true);
    assert.strictEqual(res.record.concentration, null);
    assert.strictEqual(res.record.uncertainty, null);
    assert.strictEqual(res.record.selectedModel, 'none');
    assert.strictEqual(res.record.status, 'UNSUPPORTED_ANALYTE');
  }
});

// -------------------------------------------------------------
// BUG-002: Device Normalization
// -------------------------------------------------------------
console.log('\nPHASE 2: BUG-002 Device Normalization Wavelength Scaling');
const rawProfile = new Array(151).fill(100);
const deviceCalibratedNonFlat: DeviceProfile = {
  id: 'PHONE-NON-FLAT',
  name: 'Phone With Wavelength Sensitivity Curve',
  description: 'Phone test profile',
  colorTemperatureBias: 'neutral',
  fingerprint: 'DEV-CAL-01',
  isCalibrated: true,
  spectralSensitivity: new Array(151).fill(1.0).map((_, i) => 1.0 + (i / 150) * 0.5),
  noiseRms: 0.015,
  gainDrift: 0.0,
  wavelengthOffsetPx: 0,
};

const deviceUncalibrated: DeviceProfile = {
  ...deviceCalibratedNonFlat,
  id: 'PHONE-UNCALIBRATED',
  isCalibrated: false,
};

test('uncalibrated device leaves raw spectrum unchanged', () => {
  const out = normalizeDeviceSpectrum(rawProfile, deviceUncalibrated);
  assert.deepStrictEqual(out, rawProfile);
});

test('calibrated device mathematically transforms spectrum according to sensitivity curve', () => {
  const out = normalizeDeviceSpectrum(rawProfile, deviceCalibratedNonFlat);
  assert.notDeepStrictEqual(out, rawProfile);
  assert.strictEqual(Math.round(out[0]), 100);
  assert.strictEqual(Math.round(out[150]), 67);
});

test('pipeline output profiles differ between calibrated and uncalibrated devices', () => {
  const sim = simulateSpectrum({ analyte: 'phosphate', concentration: 0.40 });
  const resUncal = executeLISAPipeline({
    sampleName: 'Device Test Uncalibrated',
    sourceMode: 'SIMULATED',
    analyteId: 'phosphate',
    deviceProfile: deviceUncalibrated,
    rawSampleIntensities: sim.sampleIntensities,
    rawBlankIntensities: sim.blankIntensities,
  });
  const resCal = executeLISAPipeline({
    sampleName: 'Device Test Calibrated',
    sourceMode: 'SIMULATED',
    analyteId: 'phosphate',
    deviceProfile: deviceCalibratedNonFlat,
    rawSampleIntensities: sim.sampleIntensities,
    rawBlankIntensities: sim.blankIntensities,
  });
  assert.notDeepStrictEqual(resUncal.alignedProfile, resCal.alignedProfile);
  assert.notDeepStrictEqual(resUncal.absorbances, resCal.absorbances);
});

// -------------------------------------------------------------
// BUG-003: Ridge Cross-Validation Replicate Leakage Fix
// -------------------------------------------------------------
console.log('\nPHASE 3: BUG-003 Ridge Leave-One-Concentration-Out CV');
test('calibration dataset has 7 concentration groups with 3 replicates each (21 total)', () => {
  const concs = PHOSPHATE_CALIBRATION_STANDARDS.map((s) => s.concentration);
  const uniqueConcs = Array.from(new Set(concs)).sort((a, b) => a - b);
  assert.strictEqual(uniqueConcs.length, 7);
  assert.deepStrictEqual(uniqueConcs, [0.0, 0.1, 0.2, 0.4, 0.6, 0.8, 1.0]);
  for (const c of uniqueConcs) {
    const count = concs.filter((val) => Math.abs(val - c) < 1e-6).length;
    assert.strictEqual(count, 3);
  }
});

test('grouped CV metrics computed with zero concentration leakage across folds', () => {
  const X = PHOSPHATE_CALIBRATION_STANDARDS.map((s) => s.absorbances);
  const y = PHOSPHATE_CALIBRATION_STANDARDS.map((s) => s.concentration);
  const model = fitRidgeRegression(X, y, 0.05);

  assert.strictEqual(model.cvGroupsCount, 7);
  assert.strictEqual(model.cvPredictionsCount, 21);
  assert.ok(model.groupedCvRmse! > 0.035, `Grouped CV RMSE (${model.groupedCvRmse}) must exceed leaked LOOCV 0.0193`);
  assert.ok(model.groupedCvRmse! < 0.070);
  assert.ok(model.groupedCvMae! > 0);
  assert.ok(model.groupedCvR2! > 0.90);
});

// -------------------------------------------------------------
// BUG-004: Dynamic Sample-Specific Uncertainty
// -------------------------------------------------------------
console.log('\nPHASE 4: BUG-004 Dynamic Sample-Specific Uncertainty');
test('noisy spectrum receives higher uncertainty than identical clean spectrum', () => {
  const cleanSim = simulateSpectrum({ analyte: 'phosphate', concentration: 0.40, noiseLevel: 0.005 });
  const noisySim = simulateSpectrum({ analyte: 'phosphate', concentration: 0.40, noiseLevel: 0.09 });

  const cleanRes = executeLISAPipeline({
    sampleName: 'Clean 0.40',
    sourceMode: 'SIMULATED',
    analyteId: 'phosphate',
    rawSampleIntensities: cleanSim.sampleIntensities,
    rawBlankIntensities: cleanSim.blankIntensities,
    groundTruth: 0.40,
  });

  const noisyRes = executeLISAPipeline({
    sampleName: 'Noisy 0.40',
    sourceMode: 'SIMULATED',
    analyteId: 'phosphate',
    rawSampleIntensities: noisySim.sampleIntensities,
    rawBlankIntensities: noisySim.blankIntensities,
    groundTruth: 0.40,
  });

  assert.ok(cleanRes.record.uncertainty !== null);
  assert.ok(noisyRes.record.uncertainty !== null);
  assert.ok(
    (noisyRes.record.uncertainty || 0) > (cleanRes.record.uncertainty || 0),
    `Noisy (${noisyRes.record.uncertainty}) should be > Clean (${cleanRes.record.uncertainty})`
  );
});

test('range edge sample has inflated uncertainty relative to mid-range', () => {
  const midSim = simulateSpectrum({ analyte: 'phosphate', concentration: 0.40, noiseLevel: 0.01 });
  const edgeSim = simulateSpectrum({ analyte: 'phosphate', concentration: 0.95, noiseLevel: 0.01 });

  const midRes = executeLISAPipeline({
    sampleName: 'Mid 0.40',
    sourceMode: 'SIMULATED',
    analyteId: 'phosphate',
    rawSampleIntensities: midSim.sampleIntensities,
    rawBlankIntensities: midSim.blankIntensities,
  });
  const edgeRes = executeLISAPipeline({
    sampleName: 'Edge 0.95',
    sourceMode: 'SIMULATED',
    analyteId: 'phosphate',
    rawSampleIntensities: edgeSim.sampleIntensities,
    rawBlankIntensities: edgeSim.blankIntensities,
  });

  assert.ok((edgeRes.record.uncertainty || 0) > (midRes.record.uncertainty || 0));
});

test('rejected / out-of-distribution sample returns null uncertainty', () => {
  const oodSample = CURATED_DEMO_SAMPLES.find((s) => s.id === 'sample-adversarial-ood')!;
  const oodSim = simulateSpectrum(oodSample.params);
  const oodRes = executeLISAPipeline({
    sampleName: oodSample.name,
    sourceMode: 'SIMULATED',
    analyteId: 'phosphate',
    rawSampleIntensities: oodSim.sampleIntensities,
    rawBlankIntensities: oodSim.blankIntensities,
  });
  assert.strictEqual(oodRes.record.isRejected, true);
  assert.strictEqual(oodRes.record.uncertainty, null);
  assert.strictEqual(oodRes.record.concentration, null);
});

// -------------------------------------------------------------
// BUG-005: Removal of Fabricated Fallbacks
// -------------------------------------------------------------
console.log('\nPHASE 5: BUG-005 Removal of Fabricated Fallbacks');
test('wavelength calibration with < 2 peaks returns isValid: false and r2: null (no fake 0.9995)', () => {
  const fit0 = fitWavelengthCalibration([]);
  assert.strictEqual(fit0.isValid, false);
  assert.strictEqual(fit0.r2, null);
  assert.strictEqual(fit0.residualRms, null);
  assert.strictEqual(fit0.errorCode, 'INSUFFICIENT_CALIBRATION_POINTS');

  const fit1 = fitWavelengthCalibration([{ lineName: 'Hg Blue', pixel: 435 }]);
  assert.strictEqual(fit1.isValid, false);
  assert.strictEqual(fit1.r2, null);
});

test('wavelength calibration with degenerate coordinates returns isValid: false', () => {
  const fitDegenerate = fitWavelengthCalibration([
    { lineName: 'Hg Blue', pixel: 500 },
    { lineName: 'Hg Green', pixel: 500 },
  ]);
  assert.strictEqual(fitDegenerate.isValid, false);
  assert.strictEqual(fitDegenerate.r2, null);
  assert.strictEqual(fitDegenerate.errorCode, 'DEGENERATE_CALIBRATION_POINTS');
});

test('Beer-Lambert calibration with < 2 standards returns isValid: false (no fake 0.99)', () => {
  const fit0 = fitBeerLambertModel([]);
  assert.strictEqual(fit0.isValid, false);
  assert.strictEqual(fit0.r2, null);
  assert.strictEqual(fit0.rmse, null);
  assert.strictEqual(fit0.lod, null);
  assert.strictEqual(fit0.loq, null);
  assert.strictEqual(fit0.errorCode, 'INSUFFICIENT_CALIBRATION_POINTS');

  const fit1 = fitBeerLambertModel([PHOSPHATE_CALIBRATION_STANDARDS[0]]);
  assert.strictEqual(fit1.isValid, false);
  assert.strictEqual(fit1.r2, null);
});

// -------------------------------------------------------------
// BUG-006: Live Camera Capture Error Handling
// -------------------------------------------------------------
console.log('\nPHASE 6: BUG-006 Live Camera Capture Verification');
test('CameraAdapter throws CAMERA_INACTIVE when capturing while not running', () => {
  const adapter = new CameraAdapter();
  assert.throws(() => adapter.captureFrame(), /CAMERA_INACTIVE/);
});

test('CameraAdapter throws VIDEO_NOT_READY when video element readyState < 2', () => {
  const mockVideo = { readyState: 0, videoWidth: 640, videoHeight: 480 } as unknown as HTMLVideoElement;
  assert.throws(() => CameraAdapter.extractSpectrumFromVideo(mockVideo), /VIDEO_NOT_READY/);
});

test('CameraAdapter throws ZERO_DIMENSIONS when video track width/height is 0', () => {
  const mockVideo = { readyState: 4, videoWidth: 0, videoHeight: 0 } as unknown as HTMLVideoElement;
  assert.throws(() => CameraAdapter.extractSpectrumFromVideo(mockVideo), /ZERO_DIMENSIONS/);
});

// -------------------------------------------------------------
// BUG-007: Unit Integrity
// -------------------------------------------------------------
console.log('\nPHASE 8: BUG-007 Model Comparison Units');
test('Beer-Lambert fit is AU and concentration RMSE is mg/L', () => {
  const cal = getOrchestratorCalibration();
  assert.strictEqual(cal.beerLambertFit.rmseUnit, 'AU');
  assert.ok(typeof cal.beerLambertFit.rmse === 'number' && cal.beerLambertFit.rmse > 0);
  assert.ok(typeof cal.beerLambertFit.concentrationRmse === 'number' && cal.beerLambertFit.concentrationRmse > 0);
  assert.ok(typeof cal.ridgeModel.groupedCvRmse === 'number' && cal.ridgeModel.groupedCvRmse > 0);
});

// -------------------------------------------------------------
// BUG-009: History Storage
// -------------------------------------------------------------
console.log('\nPHASE 7: BUG-009 History Persistence');
test('history records save and load correctly', () => {
  const memStore: Record<string, string> = {};
  // @ts-ignore
  globalThis.localStorage = {
    getItem: (k: string) => memStore[k] || null,
    setItem: (k: string, v: string) => { memStore[k] = v; },
    removeItem: (k: string) => { delete memStore[k]; },
    clear: () => { Object.keys(memStore).forEach((k) => delete memStore[k]); },
  };

  const rec = {
    id: 'TEST-REC-01',
    timestamp: new Date().toISOString(),
    analyteId: 'phosphate',
    concentration: 0.35,
    uncertainty: 0.04,
    isRejected: false,
    rejectionReason: null,
    selectedModel: 'ridge' as const,
    qualityScore: 92,
    verdict: 'SAFE' as const,
  };
  saveHistory([rec as any]);
  const loaded = loadHistory();
  assert.strictEqual(loaded.length, 1);
  assert.strictEqual(loaded[0].id, 'TEST-REC-01');

  // Corrupted storage recovery
  memStore[HISTORY_STORAGE_KEY] = 'BROKEN-JSON';
  assert.deepStrictEqual(loadHistory(), []);
});

// -------------------------------------------------------------
// BUG-010: ROI Centroid
// -------------------------------------------------------------
console.log('\nPHASE 9: BUG-010 ROI Centroid Detection');
test('variance centroid chooses Y=250 band center despite sharp edge at Y=230', () => {
  const height = 500;
  const rowVariances = new Float32Array(height);
  rowVariances[230] = 5000; // sharp edge artifact

  for (let y = 230; y <= 270; y++) {
    const dist = y - 250;
    const gaussian = 3500 * Math.exp(-(dist * dist) / (2 * 8 * 8));
    rowVariances[y] = y === 230 ? Math.max(rowVariances[y], gaussian) : gaussian;
  }

  const centroidY = computeVarianceCentroid(rowVariances, height, 0.20);
  assert.ok(Math.abs(centroidY - 250) <= 4, `Centroid (${centroidY}) should be near 250, not 230`);
  assert.notStrictEqual(centroidY, 230);
});

// -------------------------------------------------------------
// Phase 12: Benchmark Provenance
// -------------------------------------------------------------
console.log('\nPHASE 12: Benchmark Data Honesty');
test('all benchmark series explicitly marked as SIMULATED', () => {
  assert.ok(LAB_BENCHMARK_SERIES.length > 0);
  for (const s of LAB_BENCHMARK_SERIES) {
    assert.strictEqual(s.provenance, 'SIMULATED');
  }
});

// -------------------------------------------------------------
// PHASE 13: Full Simulated Lead Pipeline Verification (Tests 1–14)
// -------------------------------------------------------------
console.log('\nPHASE 13: Full Simulated Lead Pipeline Verification (Tests 1–14)');

test('TEST 1: Lead simulation at 0.4 mg/L produces peak around 520 nm', () => {
  const sim = simulateSpectrum({ analyte: 'lead', concentration: 0.40, noiseLevel: 0.001 });
  const abs = computeAbsorbance(sim.sampleIntensities, sim.blankIntensities);
  let maxA = -1;
  let maxWl = 400;
  for (let i = 0; i < abs.length; i++) {
    const wl = 400 + i * 2;
    if (abs[i] > maxA) {
      maxA = abs[i];
      maxWl = wl;
    }
  }
  assert.ok(Math.abs(maxWl - 520) <= 6, `Peak wavelength should be ~520 nm, got ${maxWl} nm`);
});

test('TEST 2: Lead Beer-Lambert prediction matches simulation truth under clean conditions', () => {
  const leadCal = getCalibrationForAnalyte('lead');
  assert.ok(leadCal.beerLambertFit.isValid);
  const cleanSim = simulateSpectrum({ analyte: 'lead', concentration: 0.40, noiseLevel: 0 });
  const cleanAbs = computeAbsorbance(cleanSim.sampleIntensities, cleanSim.blankIntensities);
  const pred = predictBeerLambert(STANDARD_WAVELENGTHS, cleanAbs, leadCal.beerLambertFit, 505, 535);
  assert.ok(Math.abs(pred.concentration - 0.40) < 0.03, `BL prediction should be ~0.40 mg/L, got ${pred.concentration}`);
});

test('TEST 3: Lead calibration statistics are dynamically calculated from data', () => {
  const leadCal = getCalibrationForAnalyte('lead');
  assert.ok(leadCal.beerLambertFit.r2! > 0.99, `R2 should be > 0.99, got ${leadCal.beerLambertFit.r2}`);
  assert.ok(leadCal.beerLambertFit.slope > 0.30 && leadCal.beerLambertFit.slope < 0.35, `Slope ~0.33, got ${leadCal.beerLambertFit.slope}`);
  assert.ok(leadCal.beerLambertFit.lod !== null && leadCal.beerLambertFit.lod > 0.05, `LOD calculated, got ${leadCal.beerLambertFit.lod}`);
  assert.ok(leadCal.ridgeModel.r2! > 0.99, `Ridge R2 > 0.99, got ${leadCal.ridgeModel.r2}`);
  assert.ok(leadCal.ridgeModel.groupedCvR2! > 0.99, `Ridge groupedCvR2 > 0.99, got ${leadCal.ridgeModel.groupedCvR2}`);
});

test('TEST 4: Lead Ridge model uses Lead training data', () => {
  const leadCal = getCalibrationForAnalyte('lead');
  assert.strictEqual(leadCal.ridgeModel.weights.length, 151);
  assert.strictEqual(leadCal.calibrationStandards.length, 33);
  assert.ok(leadCal.calibrationStandards.every((s) => s.analyteId === 'lead'));
  assert.ok(leadCal.calibrationStandards.every((s) => s.provenance === 'SIMULATED'));
});

test('TEST 5: Lead grouped CV has zero concentration leakage', () => {
  const leadCal = getCalibrationForAnalyte('lead');
  const concGroups = new Set(leadCal.calibrationStandards.map((s) => s.concentration));
  assert.strictEqual(concGroups.size, 11);
  assert.strictEqual(leadCal.ridgeModel.cvGroupsCount, 11);
  assert.ok(leadCal.ridgeModel.groupedCvRmse > 0 && leadCal.ridgeModel.groupedCvRmse < 0.03);
  assert.ok(leadCal.ridgeModel.groupedCvMae > 0 && leadCal.ridgeModel.groupedCvMae < 0.02);
});

test('TEST 6: Lead OOD marks clean Lead as IN_DISTRIBUTION', () => {
  const sim04 = simulateSpectrum({ analyte: 'lead', concentration: 0.40, noiseLevel: 0.015 });
  const res04 = executeLISAPipeline({
    sampleName: 'Lead 0.4 Clean',
    sourceMode: 'SIMULATED',
    analyteId: 'lead',
    rawSampleIntensities: sim04.sampleIntensities,
    rawBlankIntensities: sim04.blankIntensities,
  });
  assert.strictEqual(res04.ood.status, 'IN_DISTRIBUTION');
  assert.ok(res04.ood.score < 1.0, `OOD score should be < 1.0, got ${res04.ood.score}`);
});

test('TEST 7: Phosphate-as-Lead is not silently accepted as Lead', () => {
  const simPhos = simulateSpectrum({ analyte: 'phosphate', concentration: 0.40, noiseLevel: 0.015 });
  const resPhosAsLead = executeLISAPipeline({
    sampleName: 'Phosphate presented as Lead',
    sourceMode: 'SIMULATED',
    analyteId: 'lead',
    rawSampleIntensities: simPhos.sampleIntensities,
    rawBlankIntensities: simPhos.blankIntensities,
  });
  assert.strictEqual(resPhosAsLead.ood.status, 'OUT_OF_DISTRIBUTION');
  assert.strictEqual(resPhosAsLead.record.isRejected, true);
});

test('TEST 8: Unknown dye in Lead mode is rejected', () => {
  const simDye = simulateSpectrum({ analyte: 'anomaly', concentration: 0.40, noiseLevel: 0.015 });
  const resDye = executeLISAPipeline({
    sampleName: 'Tartrazine Dye in Lead Mode',
    sourceMode: 'SIMULATED',
    analyteId: 'lead',
    rawSampleIntensities: simDye.sampleIntensities,
    rawBlankIntensities: simDye.blankIntensities,
  });
  assert.strictEqual(resDye.ood.status, 'OUT_OF_DISTRIBUTION');
  assert.strictEqual(resDye.record.isRejected, true);
});

test('TEST 9: Lead 0.40 mg/L produces actual model result without direct truth injection', () => {
  const simClean = simulateSpectrum({ analyte: 'lead', concentration: 0.40, noiseLevel: 0.015 });
  const resNoTruth = executeLISAPipeline({
    sampleName: 'Lead 0.4 Blind',
    sourceMode: 'SIMULATED',
    analyteId: 'lead',
    rawSampleIntensities: simClean.sampleIntensities,
    rawBlankIntensities: simClean.blankIntensities,
  });
  assert.strictEqual(resNoTruth.record.isRejected, false);
  assert.ok(resNoTruth.record.concentration !== null);
  assert.ok(
    Math.abs(resNoTruth.record.concentration - 0.40) < 0.02,
    `Model result should be ~0.40, got ${resNoTruth.record.concentration}`
  );
  assert.notStrictEqual(resNoTruth.record.concentration, 0.4);
});

test('TEST 10: Lead 0.01 mg/L handles sub-LOD trace level without false certainty', () => {
  const sim001 = simulateSpectrum({ analyte: 'lead', concentration: 0.01, noiseLevel: 0.015 });
  const res001 = executeLISAPipeline({
    sampleName: 'Lead 0.01 Drinking Limit',
    sourceMode: 'SIMULATED',
    analyteId: 'lead',
    rawSampleIntensities: sim001.sampleIntensities,
    rawBlankIntensities: sim001.blankIntensities,
  });
  assert.strictEqual(res001.record.unit, 'mg Pb/L');
  assert.ok(res001.record.concentration !== null);
  assert.strictEqual(res001.qc.calibrationRangeCheck.status, 'WARNING');
  assert.ok(res001.qc.calibrationRangeCheck.detail.includes('Limit of Detection'));
  assert.ok(
    res001.record.explanation.headline.includes('SIMULATED') ||
      res001.record.explanation.headline.includes('Lead')
  );
});

test('TEST 11: Lead saturated sensor causes QC failure and rejection', () => {
  const simSat = simulateSpectrum({ analyte: 'lead', concentration: 0.50, isSaturated: true });
  const resSat = executeLISAPipeline({
    sampleName: 'Lead Saturated',
    sourceMode: 'SIMULATED',
    analyteId: 'lead',
    rawSampleIntensities: simSat.sampleIntensities,
    rawBlankIntensities: simSat.blankIntensities,
  });
  assert.strictEqual(resSat.record.isRejected, true);
  assert.strictEqual(resSat.qc.saturationCheck.status, 'FAIL');
});

test('TEST 12: Lead optical misalignment triggers alignment warning/failure', () => {
  const simShift = simulateSpectrum({ analyte: 'lead', concentration: 0.50, shiftPx: 10 });
  const resShift = executeLISAPipeline({
    sampleName: 'Lead Misaligned',
    sourceMode: 'SIMULATED',
    analyteId: 'lead',
    rawSampleIntensities: simShift.sampleIntensities,
    rawBlankIntensities: simShift.blankIntensities,
  });
  assert.strictEqual(resShift.record.isRejected, true);
  assert.strictEqual(resShift.qc.spectralShiftCheck.status, 'FAIL');
});

test('TEST 13: Lead turbidity triggers QC turbidity warning/failure', () => {
  const simTurbid = simulateSpectrum({ analyte: 'lead', concentration: 0.40, turbidityAU: 0.5 });
  const resTurbid = executeLISAPipeline({
    sampleName: 'Lead Turbid',
    sourceMode: 'SIMULATED',
    analyteId: 'lead',
    rawSampleIntensities: simTurbid.sampleIntensities,
    rawBlankIntensities: simTurbid.blankIntensities,
  });
  assert.strictEqual(resTurbid.qc.turbidityInterferenceCheck.status, 'WARNING');
  assert.ok(resTurbid.qc.turbidityInterferenceCheck.detail.includes('turbidity'));
});

test('TEST 14: Export preserves mg Pb/L and analyteId lead', () => {
  const simExp = simulateSpectrum({ analyte: 'lead', concentration: 0.40 });
  const resExp = executeLISAPipeline({
    sampleName: 'Lead Export Test',
    sourceMode: 'SIMULATED',
    analyteId: 'lead',
    rawSampleIntensities: simExp.sampleIntensities,
    rawBlankIntensities: simExp.blankIntensities,
  });
  saveHistory([resExp.record]);
  const history = loadHistory();
  const found = history.find((r) => r.id === resExp.record.id);
  assert.ok(found);
  assert.strictEqual(found.analyteId, 'lead');
  assert.strictEqual(found.unit, 'mg Pb/L');
});

console.log('\n============================================================');
console.log(`TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
console.log('============================================================');

if (failCount > 0) {
  process.exit(1);
}
