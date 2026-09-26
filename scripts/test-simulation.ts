// LISA simulation system — regression suite + hero scenario export.
// Run: npm run test:sim   (also part of `npm test`)

import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { simulateSpectrum } from '../src/engine/simulator';
import { SeededPRNG } from '../src/engine/prng';
import { executeLISAPipeline } from '../src/engine/orchestrator';
import { runSimulation, summarize, SimulationConfig, SIMULATION_CONFIG_VERSION } from '../src/simulation/state';
import { BASE_CONFIG, HERO_SCENARIOS, heroById } from '../src/simulation/scenarios';
import { runSweep } from '../src/simulation/sweeps';
import { simulateWavelengthCalibration } from '../src/simulation/wavecal';
import { runTwinMeasurement } from '../src/digitalTwin/twinModel';

let pass = 0;
let fail = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    pass++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    fail++;
    console.error(`  ✗ ${name}\n    ${e.message}`);
  }
};

const run = (over: Partial<SimulationConfig> = {}) => runSimulation({ ...BASE_CONFIG, ...over });
const bandMean = (a: number[], lo: number, hi: number) => {
  const idx = a.map((_, i) => 400 + 2 * i).flatMap((nm, i) => (nm >= lo && nm <= hi ? [i] : []));
  return idx.reduce((s, i) => s + a[i], 0) / idx.length;
};
const at = (nm: number) => Math.round((nm - 400) / 2);
const sd = (v: number[]) => {
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
};

console.log('LISA SIMULATION SYSTEM — REGRESSION SUITE\n');

test('01 deterministic: two fresh runs of the same config are identical', () => {
  const a = simulateSpectrum({ ...BASE_CONFIG }, new SeededPRNG('D'));
  const b = simulateSpectrum({ ...BASE_CONFIG }, new SeededPRNG('D'));
  assert.deepEqual(a.sampleIntensities, b.sampleIntensities);
  assert.deepEqual(a.blankIntensities, b.blankIntensities);
});

test('02 same seed → same pipeline result (cache bypassed via id)', () => {
  assert.deepEqual(
    { ...summarize(run({ id: 'X1' })), id: 0 },
    { ...summarize(run({ id: 'X2' })), id: 0 }
  );
});

test('03 different seed → different noise realisation', () => {
  assert.notDeepEqual(run({ seed: 'S1' }).sim.sampleIntensities, run({ seed: 'S2' }).sim.sampleIntensities);
});

test('04 concentration increases absorbance (true and measured)', () => {
  const [a, b, c] = [0.2, 0.4, 0.8].map((x) => run({ concentration: x }));
  assert.ok(a.sim.trueAbsorbance[at(680)] < b.sim.trueAbsorbance[at(680)]);
  assert.ok(b.sim.trueAbsorbance[at(680)] < c.sim.trueAbsorbance[at(680)]);
  assert.ok(bandMean(a.result.absorbances, 630, 690) < bandMean(c.result.absorbances, 630, 690));
});

test('05 path length scales absorbance linearly (Beer–Lambert A = εlc)', () => {
  const h = run({ pathLengthCm: 0.5 }).sim.trueAbsorbance[at(680)];
  const f = run({ pathLengthCm: 1 }).sim.trueAbsorbance[at(680)];
  const d = run({ pathLengthCm: 2 }).sim.trueAbsorbance[at(680)];
  assert.ok(Math.abs(f / h - 2) < 1e-9 && Math.abs(d / f - 2) < 1e-9);
  // The calibration is for 1 cm: a 0.5 cm cuvette reads about half — the pipeline is not told.
  assert.ok(run({ pathLengthCm: 0.5 }).result.record.concentration! < 0.3);
});

test('06 detector noise increases sample variance across seeds', () => {
  const spread = (noise: number) =>
    sd(Array.from({ length: 12 }, (_, k) => run({ noiseLevel: noise, seed: `N${k}` }).sim.sampleIntensities[at(560)]));
  assert.ok(spread(0.1) > 3 * spread(0.01));
});

test('07 turbidity adds λ⁻¹ scatter, raises blue baseline, QC reacts', () => {
  const t = run({ turbidityAU: 0.4 });
  assert.ok(t.sim.components.scatter[at(400)] > t.sim.components.scatter[at(700)]);
  assert.ok(t.result.qc.turbidityInterferenceCheck.status !== 'PASS');
  assert.equal(run().result.qc.turbidityInterferenceCheck.status, 'PASS');
});

test('08 device profile alters the raw spectrum', () => {
  assert.notDeepEqual(run().sim.sampleIntensities, run({ deviceId: 'device-b-warm' }).sim.sampleIntensities);
});

test('09 device calibration reduces handset mismatch', () => {
  const err = (cal: boolean) =>
    Math.abs(run({ deviceId: 'device-b-warm', deviceCalibrated: cal }).result.record.concentration! - 0.4);
  assert.ok(err(true) < err(false), `calibrated ${err(true)} vs uncalibrated ${err(false)}`);
});

test('10 over-exposure clips the sensor and QC rejects', () => {
  const s = run({ exposure: 1.5 });
  assert.equal(Math.max(...s.sim.sampleIntensities), 255);
  assert.equal(s.result.qc.saturationCheck.status, 'FAIL');
  assert.ok(s.result.record.isRejected);
  assert.equal(run({ exposure: 0.15 }).result.qc.signalStrengthCheck.status, 'FAIL');
});

test('11 misalignment shifts the spectrum; alignment detects it; beyond tolerance QC fails', () => {
  // The aligner reports the correction (opposite sign) and carries a ~1 px bias (see report).
  const detected = run({ shiftPx: 4 }).result.shiftPx;
  assert.ok(Math.sign(detected) === -1 && Math.abs(Math.abs(detected) - 4) <= 1, `detected ${detected}`);
  assert.equal(run({ shiftPx: 8 }).result.qc.spectralShiftCheck.status, 'FAIL');
});

test('12 blank correction: a flat LED drop between captures is removed by baseline correction', () => {
  const clean = run().result.record.concentration!;
  const drift = run({ sourceDrift: -0.1 });
  assert.ok(drift.result.baselineProfile[0] > 0.03, 'raw offset present');
  assert.ok(Math.abs(drift.result.record.concentration! - clean) < 0.01);
});

test('13 wavelength calibration: production fit on simulated lines; drift degrades it', () => {
  const ok = simulateWavelengthCalibration({ pixelNoise: 0, shiftPx: 0, dropLine: null, seed: 'W' });
  assert.ok(ok.fit.isValid && (ok.fit.r2 ?? 0) > 0.999 && ok.maxErrNm! < 2);
  assert.ok(simulateWavelengthCalibration({ pixelNoise: 0, shiftPx: 0, dropLine: 'Hg Green', seed: 'W' }).fit.isValid);
  assert.ok(simulateWavelengthCalibration({ pixelNoise: 0, shiftPx: 10, dropLine: null, seed: 'W' }).maxErrNm! > 3);
});

test('14 interferents change the spectrum where they absorb', () => {
  const s = run({ interferents: [{ kind: 'chlorophyll', peakAU: 0.4 }] });
  assert.ok(s.sim.components.interferent[at(432)] > 0.3 && s.sim.components.interferent[at(664)] > 0.2);
  assert.ok(s.sim.trueAbsorbance[at(432)] > run().sim.trueAbsorbance[at(432)] + 0.3);
});

test('15 OOD rejects an unrelated chromophore (not a scripted rule)', () => {
  const s = runSimulation(heroById('HERO_UNKNOWN')!.config);
  assert.equal(s.result.ood.status, 'OUT_OF_DISTRIBUTION');
  assert.ok(s.result.record.isRejected);
});

test('16 prediction derives from the spectrum, never from the truth', () => {
  const sim = simulateSpectrum({ ...BASE_CONFIG, concentration: 0.6 }, new SeededPRNG('T'));
  const go = (groundTruth?: number) =>
    executeLISAPipeline({
      sampleName: 't', sourceMode: 'SIMULATED', analyteId: 'phosphate', deviceId: 'device-a-reference',
      deviceFingerprint: 'x', rawSampleIntensities: sim.sampleIntensities, rawBlankIntensities: sim.blankIntensities, groundTruth,
    }).record.concentration;
  assert.equal(go(0.1), go(undefined));
  assert.ok(Math.abs(go(0.1)! - 0.6) < 0.05);
});

test('17 cinematic / twin view uses the same simulation state as the lab', () => {
  for (const h of HERO_SCENARIOS) {
    const { seed: _s, deviceId, id: _i, declaredAnalyteId: _a, ...params } = h.config;
    const twin = runTwinMeasurement(params, deviceId, 1, h.config);
    assert.deepEqual(summarize(twin), summarize(runSimulation(h.config)), h.id);
  }
});

test('18 no simulated result is marked experimental', () => {
  for (const h of HERO_SCENARIOS) {
    const s = runSimulation(h.config);
    assert.equal(s.provenance.kind, 'SIMULATED');
    assert.equal(s.result.record.sourceMode, 'SIMULATED');
  }
});

test('19 clean water (0 mg/L) is measured, not rejected as OOD', () => {
  const s = run({ concentration: 0 });
  assert.equal(s.result.ood.status, 'IN_DISTRIBUTION');
  assert.ok(!s.result.record.isRejected && s.result.record.concentration! < 0.02);
  assert.ok(run({ concentration: 0, interferents: [{ kind: 'tartrazine', peakAU: 0.1 }] }).result.record.isRejected);
});

test('20 reaction kinetics: colour develops monotonically toward the end-point', () => {
  const a = [1, 3, 10].map((t) => run({ reactionTimeMin: t }).sim.trueAbsorbance[at(680)]);
  const end = run().sim.trueAbsorbance[at(680)];
  assert.ok(a[0] < a[1] && a[1] < a[2] && a[2] < end);
});

test('21 stray light compresses measured absorbance (negative Beer–Lambert deviation)', () => {
  assert.ok(bandMean(run({ ambientLightCounts: 10 }).result.absorbances, 630, 690) < bandMean(run().result.absorbances, 630, 690) - 0.05);
});

test('22 sweeps are statistics of real pipeline runs', () => {
  const pts = runSweep(BASE_CONFIG, 'concentration', [0.2, 0.6], 3);
  assert.equal(pts[0].runs, 3);
  const direct = [0, 1, 2].map((k) => runSimulation({ ...BASE_CONFIG, concentration: 0.6, seed: `${BASE_CONFIG.seed}-SWEEP-${k}` }).result.record.concentration!);
  assert.ok(Math.abs(pts[1].meanPredicted! - direct.reduce((a, b) => a + b) / 3) < 1e-12);
});

// ---------------------------------------------------------------------------
// Export hero scenarios with computed outcomes
// ---------------------------------------------------------------------------

const out = {
  generatedBy: 'scripts/test-simulation.ts',
  configVersion: SIMULATION_CONFIG_VERSION,
  provenance: 'SIMULATED — physically grounded simulation run through the production LISA pipeline. Not experimental data.',
  howToOpen: { lab: '#/lab', twin: '#/twin?hero=<ID>', cinema: '#/twin?cinema=1&autoplay=1', scene: '#/twin?cinema=1&scene=<name>' },
  cinemaScenes: ['device', 'explode', 'led', 'cuvette', 'slit', 'grating', 'camera', 'optics', 'dispersion', 'sensor', 'spectrum', 'compute', 'result', 'unknown', 'rejection'],
  scenarios: HERO_SCENARIOS.map((h) => ({
    id: h.id,
    label: h.label,
    story: h.story,
    twinUrl: `#/twin?hero=${h.id}`,
    config: h.config,
    computedOutcome: summarize(runSimulation(h.config)),
  })),
};
writeFileSync('LISA_SIMULATION_SCENARIOS.json', JSON.stringify(out, null, 2) + '\n');
console.log('\n  hero scenario           truth    predicted ± unc       QC       OOD');
for (const s of out.scenarios) {
  const o = s.computedOutcome;
  console.log(
    `  ${s.id.padEnd(22)} ${String(o.truth ?? '—').padEnd(8)} ${(o.rejected ? 'REJECTED' : `${o.predicted} ± ${o.uncertainty}`).padEnd(20)} ${o.qc.padEnd(8)} ${o.ood}`
  );
}
console.log(`\nWrote LISA_SIMULATION_SCENARIOS.json\nSIMULATION SUMMARY: ${pass} PASSED, ${fail} FAILED`);
if (fail) process.exit(1);
