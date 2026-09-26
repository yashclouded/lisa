# LISA Simulation Report

> All results below are **simulated**. They were produced by the LISA simulator and the production
> pipeline, not measured on hardware. See `LISA_SIMULATION_SYSTEM.md` for the model and its assumptions.

## 1. What was upgraded

| Area | Before | Now |
|---|---|---|
| Measurement state | Twin had its own `runTwinMeasurement`; other views called the simulator ad hoc | `src/simulation/state.ts`: `runSimulation(config) → SimulationState`, memoised; the Twin's measurement *is* this state |
| Simulator physics | fixed 1 cm path, end-point chemistry, boolean saturation, sample-only hard-coded device tint | + path length, reaction kinetics, exposure × gain with real clipping, ambient stray light, LED drift between captures, 4 named interferents, device response taken from the `DeviceProfile` the pipeline normalises with (+ registration offset); legacy path bit-identical |
| Simulator output | total true absorbance | + true absorbance split by cause (analyte / interferent / scatter) and reaction progress |
| Pipeline output | selected estimate only | + both Beer–Lambert and Ridge estimates (additive fields) |
| OOD | rejected 0 mg/L (clean water) as out-of-distribution | shape test only applied when the smoothed spectrum carries structure above the noise floor (see §4.1) |
| Twin | one fixed story, no deep links | `#/twin?hero=…`, `?cfg=…` (same seed as the lab), `?cinema=1` (recording layout), `?scene=…` (deterministic hold), `?autoplay=1`; result unit on the 3D phone screen fixed (was hard-coded "mg P/L" for lead) |
| New views | — | Simulation Lab `#/lab`: chain panels, reaction play/scrub, presets, hero scenarios, sweeps, wavelength-calibration lab, chain replay |

Files: `src/simulation/{state,scenarios,sweeps,wavecal}.ts`, `src/simulation/SimulationLab.tsx`,
`src/simulation/simulationLab.css`, `scripts/test-simulation.ts`. Edits: `src/engine/simulator.ts`,
`src/engine/orchestrator.ts` (+2 output fields), `src/engine/ood.ts` (blank gate),
`src/digitalTwin/{twinModel.ts,DigitalTwin.tsx,digitalTwin.css}`, `src/Root.tsx`,
`src/components/Header.tsx`, `package.json`.

Not rebuilt: the 3D scene, jury story, sample library, field-day route and device-calibration modal.
They already existed and now either run on the shared state or were left unchanged.
Field-day mode (Phase 20) is already implemented in the Sample Library, so it was not duplicated.

## 2. Hero scenarios (fixed seeds, computed outcomes)

Seed = scenario id. Values are copied from `LISA_SIMULATION_SCENARIOS.json`, which `npm run test:sim` regenerates.

| Scenario | Truth | LISA output | QC | OOD | What it shows |
|---|---|---|---|---|---|
| HERO_PHOSPHATE | 0.400 | 0.399 ± 0.211 | PASS | in | baseline |
| HERO_LEAD | 0.500 | 0.500 ± 0.083 | PASS | in | simulated lead calibration |
| HERO_UNKNOWN | 0.100 + dye | **rejected** | advisory | **out** | OOD refuses an uncalibrated chromophore |
| HERO_TURBID | 0.400 | 0.286 ± 0.201 | advisory | in | scatter biases low; QC warns, does not reject |
| HERO_SATURATED | 0.400 | **rejected** | FAIL | in | exposure 1.5× clips the sensor |
| HERO_MISALIGNED | 0.400 | **rejected** | FAIL | in | 8 px shift beyond tolerance |
| HERO_DEVICE_MISMATCH | 0.400 | 0.425 ± 0.443 | PASS | in | uncalibrated budget phone: biased, very wide ± |
| HERO_STRAY_LIGHT | 0.400 | 0.299 ± 0.232 | PASS | in | **blind spot**: light leak biases −25 %, QC passes |
| HERO_EARLY_READ | 0.400 | 0.180 ± 0.099 | advisory | in | **blind spot**: read at 2 min (45 % developed) |

## 3. Tests performed

- `npm test`: existing suite **36/36** plus new simulation suite **22/22**
  (`scripts/test-simulation.ts`). It covers all 18 required checks plus: blank water is not rejected,
  kinetics are monotone, stray light compresses A, and sweeps equal direct pipeline runs.
- `npm run test:lisa` **50/50**; `npm run test:twin` passes (twin scenario outputs identical to before);
  `scripts/verify-golden-tests.ts` 6/6.
- `npm run build` passes; `npm run lint` shows no new warnings (4 pre-existing `only-export-components`).
- Browser checks at 1440×900, 1920×1080 and 375×812 (no horizontal scroll): Lab panels, sweep run,
  wavelength lab, reaction playback (2 min → 45 % → 0.181; 15 min → 99 % → 0.395), cinema scenes
  `result` and `rejection`, and `hero=HERO_TURBID` (twin shows 0.286 ± 0.201, identical to the lab
  and JSON). No console errors.

Note: `npm run test:lisa` rewrites `LISA_SAMPLE_TEST_RESULTS.json` / `LISA_SAMPLE_TEST_REPORT.md`.
They were regenerated against the updated engine (all 50 still pass).

## 4. Findings the simulation exposed

The point of a software-defined instrument is that you can stress it. These were found by the twin
and are reported, not hidden.

1. **Clean water was refused** (fixed). At exactly 0 mg/L the absorbance is pure noise, the OOD
   shape correlation against the phosphate profile is ≈ 0, and the sample was rejected. The shape
   test now requires the 9-point-smoothed spectrum to have RMS > 0.008 AU. Smoothing suppresses
   white noise ~3× but leaves real bands, so a noisy blank passes while a 0.1 AU tartrazine-like dye
   on a 0 mg/L sample is still rejected (test 19).
2. **Uncertainty is very conservative.** In sweeps the ± interval covers the truth in 100 % of
   accepted runs while being 20–50× the observed error (e.g. 0.4 mg/L: error ≈ 0.004, ± 0.21).
   Root cause: structured spectral residuals, not the error-propagation formula. A white/structured
   residual split gave almost the same width. The structure comes from finding 3 and from the
   calibration standards never passing through alignment. The engine was left unchanged;
   recommended fix: build the calibration through the same alignment path, then calibrate the ±
   against simulated coverage.
3. **Aligner bias.** Cross-correlation reports the *correction* (opposite sign) and has a systematic
   −1 px bias on clean samples, because the analyte's absorption changes the profile shape. That
   leaves a ~0.06 AU artefact near 450 nm, and a +6 px displacement (nominally within ±6 px) is
   detected as −7 px and fails QC. Registering on the 400–500 nm LED pump peak fixed the bias but
   was **reverted**: a tartrazine-like dye absorbs inside that window and escaped OOD.
4. **Stray light is invisible to QC.** 10–12 counts of ambient leak bias results −22 to −25 % with
   QC PASS. Mitigation: light-tight enclosure (the build plan's black card) and an ambient-only
   (LED-off) frame to subtract.
5. **Reading too early is invisible to QC.** 1 min → −74 %, 2 min → −55 %. Mitigation: the app should
   enforce the reaction timer.
6. **Turbidity biases low** (0.3 AU → −28 %) with only a QC advisory. The offset-zero baseline
   subtracts the 400–450 nm minimum, which over-subtracts λ⁻¹ scatter at 675 nm.
7. **Band-overlapping interferents are not rejected.** A chlorophyll-like pigment at 0.6 AU → ≈ +105 %
   (flagged only by ± 0.81); a red dye with lead → +137 % with QC PASS. Colorimetry cannot separate
   overlapping chromophores. A residual-based (Q-statistic) OOD test is the natural next step.
8. **Path length is calibration-specific.** A 0.5 cm cuvette reads about half (test 05). The
   cuvette is a fixed part of the method.

## 5. Deterministic seeds

| Use | Seed |
|---|---|
| Hero scenarios | the scenario id (e.g. `HERO_TURBID`) |
| Lab default | `HERO_PHOSPHATE` |
| Twin runs | `LISA-TWIN-<run>`; with `hero`/`cfg`, run 1 uses the origin seed exactly, later runs `<seed>-R<run>` |
| Cinema `scene=result` | `LISA-TWIN-2`; `scene=rejection` → `LISA-TWIN-3` (guarded against StrictMode double-run) |
| Sweeps | `<config seed>-SWEEP-<k>`, k = 0..5 |
| Wavelength lab | `LISA-WAVECAL` |
| Calibration standards (unchanged) | `LISA-DEMO-2026-CAL`, `LISA-CAL-LEAD-2026` |

## 6. Important assumptions

- Kinetic rate constants, interferent spectra, handset curves and stray-light magnitudes are
  illustrative approximations, not characterisations.
- The blank is a reagent blank (reagent absorbance cancels), and I₀ is the reference-handset blank
  stored with the calibration (why handset response does not cancel).
- Spectral shift is quantised to 2 nm bins; the 1000-column sensor strip is a rendering of the 151
  simulated bins placed by the grating equation, not a simulated pixel-level readout.
- Ray paths are geometric optics (grating equation + pinhole), not electromagnetic simulation.

## 7. Performance

- One full simulation + pipeline run: **≈0.36 ms** (Node, M-series). Memoised repeats: ≈0.003 ms.
- A 72-run sweep: ≈16 ms (≈30 ms in the browser). Sweeps run only on click, never during animation.
- Reaction playback re-runs the pipeline every animation frame at 0.1 min resolution, and cached
  frames are reused on replay. Controls use `useDeferredValue` so sliders stay responsive.
- The Lab is a separate lazy chunk (28 kB JS, 4 kB CSS); three.js stays in the Twin chunk.

## 8. Linkage audit

Every Lab control changes a pipeline input (§2 of the system doc). Rejected as decorative:
a sensor-temperature slider (no temperature term exists downstream), a separate pixel-response
non-uniformity control (it cancels in I/I₀ for a same-pixel ratio), and slit-width (not in the
numerical model). The Twin's 3D beam, cuvette colour, dispersion fan and sensor texture are all
driven from `sim.sampleIntensities` / `transmittedColor` of the shared state.

## 9. Remaining limitations

- Findings 2, 3, 6 and 7 are real pipeline limitations left for a deliberate engine change; they
  would alter calibration outputs that other components and reports depend on.
- The Twin's own control panel exposes the original parameters. The new physics parameters are set
  in the Lab and carried into 3D via "Open in 3D twin".
- Turbidity is not rendered as a diffuse beam in 3D; it shows only through the transmitted colour and
  intensities.
- Lead remains a **simulated research model**; nothing here speaks to real ppb-level lead detection.
