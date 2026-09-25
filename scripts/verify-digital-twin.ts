// Digital twin checks: the twin must be a thin, deterministic view over the
// production engine. Run: npm run test:twin   (add --write to refresh the
// scenario golden file LISA_DIGITAL_TWIN_SCENARIOS.json from the engine).

import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  SCENARIOS,
  runTwinMeasurement,
  applyFaults,
  BASE_PARAMS,
  SENSOR_CALIBRATION,
  pixelOfWavelength,
  wavelengthAtSensorX,
  sensorX,
  transmittedColor,
} from '../src/digitalTwin/twinModel';
import { simulateSpectrum } from '../src/engine/simulator';
import { executeLISAPipeline } from '../src/engine/orchestrator';
import { SeededPRNG } from '../src/engine/prng';

const GOLDEN = 'LISA_DIGITAL_TWIN_SCENARIOS.json';

// 1. The twin adds nothing to the numbers: same seed straight through the
//    production functions gives the identical record.
const twin = runTwinMeasurement(BASE_PARAMS, 'device-a-reference', 1);
const sim = simulateSpectrum(
  { ...BASE_PARAMS, deviceProfileId: 'device-a-reference' },
  new SeededPRNG('LISA-TWIN-1')
);
assert.deepEqual(twin.sim.sampleIntensities, sim.sampleIntensities);
const direct = executeLISAPipeline({
  sampleName: 'x',
  sourceMode: 'SIMULATED',
  analyteId: 'phosphate',
  deviceId: 'device-a-reference',
  deviceFingerprint: 'LISA-7F42-REF1',
  rawSampleIntensities: sim.sampleIntensities,
  rawBlankIntensities: sim.blankIntensities,
});
assert.equal(twin.result.record.concentration, direct.record.concentration);
assert.deepEqual(twin.result.absorbances, direct.absorbances);

// 2. Determinism: same run → same result; slider moves change the answer.
assert.deepEqual(
  runTwinMeasurement(BASE_PARAMS, 'device-a-reference', 7).result.absorbances,
  runTwinMeasurement(BASE_PARAMS, 'device-a-reference', 7).result.absorbances
);
const lo = runTwinMeasurement({ ...BASE_PARAMS, concentration: 0.2 }, 'device-a-reference', 1);
const hi = runTwinMeasurement({ ...BASE_PARAMS, concentration: 0.8 }, 'device-a-reference', 1);
assert.ok(hi.result.record.concentration! > lo.result.record.concentration! + 0.4);

// Every control reaches the pipeline: noise, turbidity, shift and handset
// each change what the engine computes.
const baseAbs = runTwinMeasurement(BASE_PARAMS, 'device-a-reference', 1).result.absorbances;
for (const [label, p, dev] of [
  ['noise', { ...BASE_PARAMS, noiseLevel: 0.1 }, 'device-a-reference'],
  ['turbidity', { ...BASE_PARAMS, turbidityAU: 0.3 }, 'device-a-reference'],
  ['shift', { ...BASE_PARAMS, shiftPx: 4 }, 'device-a-reference'],
  ['device', BASE_PARAMS, 'device-b-warm'],
] as const) {
  const abs = runTwinMeasurement(p, dev, 1).result.absorbances;
  assert.notDeepEqual(abs, baseAbs, `${label} did not reach the pipeline`);
}

// 3. Faults reach the pipeline and the pipeline — not the twin — rejects.
const rejected = (f: Parameters<typeof applyFaults>[1]) =>
  runTwinMeasurement(applyFaults(BASE_PARAMS, f), 'device-a-reference', 1).result.record.isRejected;
assert.equal(rejected([]), false);
assert.equal(rejected(['dye']), true);
assert.equal(rejected(['saturate']), true);
assert.equal(rejected(['shift']), true);

// Lead is simulated (Pb–dithizone, 520 nm) and declared as lead; the pipeline
// processes it through the simulated Lead calibration model.
const lead = runTwinMeasurement({ ...BASE_PARAMS, analyte: 'lead', concentration: 1 }, 'device-a-reference', 1);
assert.equal(lead.result.record.status, 'OK');
assert.ok(lead.result.record.concentration !== null && Math.abs(lead.result.record.concentration - 1) < 0.05);
assert.equal(lead.result.record.unit, 'mg Pb/L');
const leadT = (i: number) => lead.sim.sampleIntensities[i] / lead.sim.blankIntensities[i];
assert.ok(leadT((520 - 400) / 2) < leadT((650 - 400) / 2), 'lead should absorb at 520 nm');

// Truly uncalibrated analytes (e.g. iron) must still be refused by the pipeline
const uncalibrated = executeLISAPipeline({
  sampleName: 'uncal',
  sourceMode: 'SIMULATED',
  analyteId: 'iron',
  deviceId: 'device-a-reference',
  deviceFingerprint: 'LISA-7F42-REF1',
  rawSampleIntensities: sim.sampleIntensities,
  rawBlankIntensities: sim.blankIntensities,
});
assert.equal(uncalibrated.record.status, 'UNSUPPORTED_ANALYTE');
assert.equal(uncalibrated.record.concentration, null);

// 4. Optics: grating geometry is monotonic, round-trips, and the production
//    linear wavelength fit over it stays within a few nm.
assert.ok(Math.abs(sensorX(550)) < 1e-12);
assert.ok(Math.abs(wavelengthAtSensorX(sensorX(640)) - 640) < 1e-9);
assert.ok(pixelOfWavelength(450) < pixelOfWavelength(600));
assert.ok(SENSOR_CALIBRATION.isValid && SENSOR_CALIBRATION.residualRms! < 5);

// 5. A blank transmits white; molybdenum blue removes red.
const white = transmittedColor(sim.blankIntensities, sim.blankIntensities).rgb;
assert.ok(white.every((c) => Math.abs(c - 1) < 1e-9));
const blue = transmittedColor(sim.blankIntensities, sim.sampleIntensities).rgb;
assert.ok(blue[0] < blue[2]);

// 6. Scenario golden file — outputs recorded from the engine, not authored.
const rows = SCENARIOS.map((s) => {
  const m = runTwinMeasurement(s.params, s.deviceId, 1);
  const r = m.result;
  return {
    id: s.id,
    label: s.label,
    description: s.description,
    measurementId: m.id,
    seed: m.seed,
    deviceId: s.deviceId,
    params: s.params,
    engineOutput: {
      concentration: r.record.concentration,
      uncertainty: r.record.uncertainty,
      unit: r.record.unit,
      verdict: r.record.verdict,
      selectedModel: r.record.selectedModel,
      qcStatus: r.qc.overallStatus,
      oodStatus: r.ood.status,
      oodScore: r.ood.score,
      detectedShiftPx: r.shiftPx,
      isRejected: r.record.isRejected,
      rejectionReason: r.record.rejectionReason ?? null,
    },
  };
});

const doc = {
  note: 'SIMULATED. Deterministic digital-twin scenarios. engineOutput is produced by the production LISA pipeline (src/engine) from the seeded simulator; regenerate with `npm run test:twin -- --write`. Not experimental data.',
  sensorCalibration: {
    model: 'λ(p) = a·p + b (production fitWavelengthCalibration over CFL lines placed by the grating equation)',
    slopeNmPerPx: +SENSOR_CALIBRATION.slope.toFixed(5),
    interceptNm: +SENSOR_CALIBRATION.intercept.toFixed(3),
    r2: SENSOR_CALIBRATION.r2,
    residualRmsNm: SENSOR_CALIBRATION.residualRms,
  },
  scenarios: rows,
};

if (process.argv.includes('--write')) {
  writeFileSync(GOLDEN, JSON.stringify(doc, null, 2) + '\n');
  console.log(`wrote ${GOLDEN}`);
} else {
  const saved = JSON.parse(readFileSync(GOLDEN, 'utf8'));
  assert.deepEqual(saved.scenarios, JSON.parse(JSON.stringify(rows)), `${GOLDEN} is stale — engine output changed`);
}

for (const r of rows) {
  const o = r.engineOutput;
  console.log(
    `  ${r.id.padEnd(18)} ${o.isRejected ? 'REJECTED'.padEnd(8) : String(o.concentration).padEnd(8)} QC ${o.qcStatus.padEnd(7)} ${o.oodStatus}`
  );
}
console.log('digital twin checks passed');
