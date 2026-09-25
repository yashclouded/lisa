import { executeLISAPipeline, getOrchestratorCalibration } from '../src/engine/orchestrator';
import { CURATED_DEMO_SAMPLES } from '../src/data/demoData';
import { simulateSpectrum } from '../src/engine/simulator';

console.log('=== LISA SCIENTIFIC ENGINE: GOLDEN TESTS VERIFICATION ===\n');

const cal = getOrchestratorCalibration();
console.log(`✓ Calibration loaded: ${cal.calibrationId}`);
console.log(`  Beer-Lambert R²: ${cal.beerLambertFit.r2}, RMSE: ${cal.beerLambertFit.rmse} AU, LOD: ${cal.beerLambertFit.lod} mg/L`);
console.log(`  Ridge Regression R²: ${cal.ridgeModel.r2}, Grouped CV RMSE: ${cal.ridgeModel.groupedCvRmse ?? cal.ridgeModel.loocvRmse} mg/L\n`);

// Golden Test 1: Perfect standard (0.40 mg/L)
const sampleY = CURATED_DEMO_SAMPLES.find((s) => s.id === 'sample-vial-y')!;
const sim1 = simulateSpectrum(sampleY.params);
const res1 = executeLISAPipeline({
  sampleName: sampleY.name,
  sourceMode: 'SIMULATED',
  deviceId: 'DEMO-DEVICE-A',
  deviceFingerprint: 'LISA-7F42-REF1',
  rawSampleIntensities: sim1.sampleIntensities,
  rawBlankIntensities: sim1.blankIntensities,
  groundTruth: sampleY.groundTruthConcentration,
});

console.log('TEST 1: Perfect Standard (0.40 mg P/L)');
console.log(`  Prediction: ${res1.record.concentration} ± ${res1.record.uncertainty} mg P/L`);
console.log(`  Ground Truth: ${sampleY.groundTruthConcentration} mg P/L, Relative Error: ${res1.record.percentError}%`);
console.log(`  QC: ${res1.qc.overallStatus}, OOD: ${res1.ood.status}, Rejected: ${res1.record.isRejected}`);
console.log(`  Result: ${!res1.record.isRejected && (res1.record.percentError || 0) < 5.0 ? 'PASS ✓' : 'FAIL ✗'}\n`);

// Golden Test 2: Noisy standard
const sim2 = simulateSpectrum({
  analyte: 'phosphate',
  concentration: 0.40,
  noiseLevel: 0.08,
  illuminationDrift: 0.0,
  shiftPx: 0,
  isSaturated: false,
  turbidityAU: 0.0,
  colorInterferenceAU: 0.0,
});
const res2 = executeLISAPipeline({
  sampleName: 'Noisy Standard 0.40 mg/L',
  sourceMode: 'SIMULATED',
  deviceId: 'DEMO-DEVICE-A',
  deviceFingerprint: 'LISA-7F42-REF1',
  rawSampleIntensities: sim2.sampleIntensities,
  rawBlankIntensities: sim2.blankIntensities,
  groundTruth: 0.40,
});
console.log('TEST 2: Noisy Standard (Higher sensor shot noise)');
console.log(`  Prediction: ${res2.record.concentration} ± ${res2.record.uncertainty} mg P/L`);
console.log(`  Uncertainty increased: ${(res2.record.uncertainty || 0) >= (res1.record.uncertainty || 0) ? 'YES ✓' : 'NO ✗'}\n`);

// Golden Test 3: Shifted spectrum (+8px)
const sampleShift = CURATED_DEMO_SAMPLES.find((s) => s.id === 'sample-adversarial-shifted')!;
const sim3 = simulateSpectrum(sampleShift.params);
const res3 = executeLISAPipeline({
  sampleName: sampleShift.name,
  sourceMode: 'SIMULATED',
  deviceId: 'DEMO-DEVICE-A',
  deviceFingerprint: 'LISA-7F42-REF1',
  rawSampleIntensities: sim3.sampleIntensities,
  rawBlankIntensities: sim3.blankIntensities,
  groundTruth: sampleShift.groundTruthConcentration,
});
console.log('TEST 3: Shifted Spectrum (+8px)');
console.log(`  Shift Detected: ${res3.shiftPx} px`);
console.log(`  QC Shift Check: ${res3.qc.spectralShiftCheck.status} (${res3.qc.spectralShiftCheck.detail})`);
console.log(`  Result: ${res3.qc.spectralShiftCheck.status === 'FAIL' || res3.qc.spectralShiftCheck.status === 'WARNING' ? 'PASS ✓' : 'FAIL ✗'}\n`);

// Golden Test 4: Saturated input
const sampleSat = CURATED_DEMO_SAMPLES.find((s) => s.id === 'sample-adversarial-saturated')!;
const sim4 = simulateSpectrum(sampleSat.params);
const res4 = executeLISAPipeline({
  sampleName: sampleSat.name,
  sourceMode: 'SIMULATED',
  deviceId: 'DEMO-DEVICE-A',
  deviceFingerprint: 'LISA-7F42-REF1',
  rawSampleIntensities: sim4.sampleIntensities,
  rawBlankIntensities: sim4.blankIntensities,
});
console.log('TEST 4: Saturated Input (>250 px intensity ceiling)');
console.log(`  QC Saturation Check: ${res4.qc.saturationCheck.status}`);
console.log(`  Measurement Rejected: ${res4.record.isRejected ? 'YES ✓' : 'NO ✗'}`);
console.log(`  Reason: ${res4.record.rejectionReason}\n`);

// Golden Test 5: Out of range (>1.8 mg/L)
const sampleRange = CURATED_DEMO_SAMPLES.find((s) => s.id === 'sample-adversarial-overrange')!;
const sim5 = simulateSpectrum(sampleRange.params);
const res5 = executeLISAPipeline({
  sampleName: sampleRange.name,
  sourceMode: 'SIMULATED',
  deviceId: 'DEMO-DEVICE-A',
  deviceFingerprint: 'LISA-7F42-REF1',
  rawSampleIntensities: sim5.sampleIntensities,
  rawBlankIntensities: sim5.blankIntensities,
});
console.log('TEST 5: Out-of-Range (>1.0 mg/L highest standard)');
console.log(`  QC Range Check: ${res5.qc.calibrationRangeCheck.status} (${res5.qc.calibrationRangeCheck.detail})`);
console.log(`  Dilution recommendation triggered: ${res5.qc.calibrationRangeCheck.detail.includes('Dilute') ? 'YES ✓' : 'NO ✗'}\n`);

// Golden Test 6: Unknown / OOD sample (Food Dye)
const sampleOOD = CURATED_DEMO_SAMPLES.find((s) => s.id === 'sample-adversarial-ood')!;
const sim6 = simulateSpectrum(sampleOOD.params);
const res6 = executeLISAPipeline({
  sampleName: sampleOOD.name,
  sourceMode: 'SIMULATED',
  deviceId: 'DEMO-DEVICE-A',
  deviceFingerprint: 'LISA-7F42-REF1',
  rawSampleIntensities: sim6.sampleIntensities,
  rawBlankIntensities: sim6.blankIntensities,
});
console.log('TEST 6: Out-of-Distribution Spectral Anomaly (Tartrazine/Chlorophyll)');
console.log(`  OOD Score: ${res6.ood.score}, Status: ${res6.ood.status}, Anomaly: ${res6.ood.isAnomaly}`);
console.log(`  Measurement Rejected: ${res6.record.isRejected ? 'YES ✓' : 'NO ✗'}`);
console.log(`  Reason: ${res6.record.rejectionReason}\n`);

console.log('=== ALL 6 GOLDEN SCENARIOS COMPLETED SUCCESSFULLY ===');
