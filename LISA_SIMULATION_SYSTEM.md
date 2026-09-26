# LISA Simulation System

> **Provenance: SIMULATED.** Everything described here is a physically grounded simulation of the LISA
> instrument. It produces *synthetic* optical measurements that are processed by the *production*
> LISA pipeline. None of it is experimental data, and no number it produces is a measured field
> accuracy, detection limit or kinetic constant.

## 1. Architecture: one measurement, one source of truth

```
SimulationConfig ──► simulateSpectrum()            (src/engine/simulator.ts, production simulator)
  chemistry            │  I₀(λ), I(λ), true A(λ) split by cause, reaction progress
  optics               ▼
  sensor           executeLISAPipeline()           (src/engine/orchestrator.ts, unchanged pipeline)
  environment          │  device normalisation → alignment → A = −log₁₀(I/I₀) → baseline
  seed                 │  → Beer–Lambert + Ridge → model selection → OOD → QC → uncertainty
                       ▼
                 SimulationState                   (src/simulation/state.ts)
                       │
     ┌─────────────────┼──────────────────┬───────────────────┬──────────────────┐
  Simulation Lab   Digital Twin (3D)   Cinematic mode      Sweeps           Test suite +
  #/lab            #/twin              #/twin?cinema=1     (lab)            scenario export
```

- `runSimulation(config)` is the **only** entry point. It calls the production simulator with a
  seeded PRNG, then the unchanged production pipeline, and returns a `SimulationState`
  (`config`, `params`, `sim`, `result`, `analyte`, `truth`, `provenance`). Results are memoised by
  config, so scrubbing or re-rendering never re-runs the pipeline for the same input.
- The Digital Twin's `TwinMeasurement` **is** `SimulationState`; `runTwinMeasurement()` is a thin
  wrapper that picks the seed. The 3D scene, sensor strip, plots, phone screen and result card all
  read that one object. No view computes chemistry or concentration.
- The simulated truth is passed to the pipeline only as `groundTruth` for the "% error" display.
  Inference never sees it (regression test 16 proves this by changing it and getting the same answer).

No scientific formula was duplicated: Beer–Lambert, Ridge, grouped CV, OOD, QC, uncertainty,
device normalisation, alignment and wavelength calibration are all called from `src/engine/`.

## 2. SimulationConfig (the state's inputs)

| Group | Field | Effect in the computation |
|---|---|---|
| Chemistry | `analyte`, `concentration` | ε(λ)·l·c of the reacted chromophore (molybdenum blue 680 nm, Pb-dithizone 520 nm) |
| Chemistry | `reactionTimeMin` | fraction developed f(t) = 1 − e^(−kt) scales the analyte absorbance; `undefined` = end-point |
| Chemistry | `interferents[]` | extra absorbance from named chromophores (tartrazine-like, chlorophyll-like, red dye, humic) |
| Matrix | `turbidityAU` | broadband scatter ∝ λ⁻¹ added to absorbance |
| Matrix | `colorInterferenceAU` | legacy humic background ∝ λ^-2.5 |
| Optics | `pathLengthCm` | Beer–Lambert l for analyte and interferents |
| Source | `illuminationDrift` | LED output level (both captures) |
| Source | `sourceDrift` | LED output change *between* blank and sample capture |
| Environment | `ambientLightCounts` | unattenuated stray light added to both captures (stray-light error) |
| Sensor | `exposure` | exposure × gain on LED light; ≳1.25 clips the 450 nm LED peak at 255 counts (QC saturation fails from ≈1.22), ≲0.15 starves the signal |
| Sensor | `noiseLevel` | read + shot noise, σ = noise·(5 + √I) |
| Sensor | `deviceId`, `deviceCalibrated` | handset spectral sensitivity, registration offset, extra read noise; calibration toggles pipeline normalisation |
| Geometry | `shiftPx` | cuvette/optical displacement in 2 nm spectral bins |
| Sensor | `isSaturated` | legacy "every pixel clips" switch, kept for old scenarios |
| Provenance | `seed`, `id` | deterministic noise realisation; same seed ⇒ identical state |

Every field changes a number in the chain. None is animation-only (see the linkage audit in the report).

**Backward compatibility.** All new fields default to no-ops, and the legacy code path is preserved
bit-for-bit, so the phosphate and lead calibration standards, golden tests, sample library and twin
scenarios produce identical numbers to before.

## 3. Chemical model

- **Absorbance**: A(λ) = ε(λ) · l · c · f(t) + Σ interferents + scatter + humic. ε(λ) profiles are
  unchanged from the production simulator (molybdenum blue: 680 nm band plus NIR rise; Pb(HDz)₂:
  0.33 AU per mg/L per cm at 520 nm, FWHM ≈ 80 nm).
- **Kinetics** (`REACTION_RATE_PER_MIN`): phosphate k = 0.3 min⁻¹ (~95 % at 10 min, matching the read
  time of EPA 365.3), lead k = 1.2 min⁻¹. **These rate constants are illustrative, not measured.**
  An unknown dye is pre-coloured, so it does not develop.
- **Reagent background**: not simulated separately. The blank is assumed to be a *reagent blank*, so
  reagent absorbance cancels in I/I₀. This is an assumption.
- **Interferents** (`INTERFERENTS`): unit-peak Gaussian approximations of literature band positions.
  Tartrazine-like λmax 426 nm; chlorophyll-like Soret 432 nm + Q band 663 nm (overlaps phosphate);
  Allura-red-like 504 nm (near lead); humic ∝ λ^-2.5. They are simulated shapes, not measured spectra.

## 4. Optical model

- **LED**: phosphor white LED = 450 nm GaN pump + 565 nm and 625 nm phosphor bands (production
  `getWhiteLEDBaseProfile`). It is deliberately weak in the deep red, which is why phosphate's 675 nm
  band sits at ~25 counts on the blank.
- **Transmission**: I = (LED · exposure · drift_between_captures) · 10^(−A) + ambient. Ambient light is
  not attenuated by the sample, which reproduces the classic negative Beer–Lambert deviation.
- **Dispersion and sensor placement**: 1000 lines/mm transmission grating on a 33.4° wedge. The
  grating equation plus pinhole projection map λ to sensor columns (`twinModel.ts`). This is geometric
  optics for explanation, not an electromagnetic simulation.
- **Colour**: the cuvette colour is LED × T(λ) projected to RGB (`transmittedColor`), so the colour you
  see is computed from the same arrays the pipeline processes.

## 5. Sensor model

- 8-bit counts; clipping at 255 applies to both blank and sample captures. Blank floor = 10 · min(1, exposure).
- Noise: blank σ = 4·noise; sample σ = noise·(5 + √I) (read + shot), seeded Box–Muller.
- **Handsets** (`DEMO_DEVICES`): the simulator applies each profile's own `spectralSensitivity`,
  `wavelengthOffsetPx` and (budget phone) extra read noise, and the pipeline's
  `normalizeDeviceSpectrum` divides by the same curve when the device is calibrated. There is a
  single definition of each phone's response.
- **Assumption (stated, not hidden)**: the blank I₀ is the *reference-handset blank stored with the
  calibration*, so a different phone's spectral response does not cancel in I/I₀. If the blank were
  captured on the same phone, sensitivity would cancel and only registration offset and noise would
  differ.

## 6. Environment

| Effect | Downstream quantity |
|---|---|
| Ambient light leak | adds counts to I and I₀ → compresses A → low bias (not caught by QC) |
| LED drift between captures | flat absorbance offset → removed by baseline correction (negative drift) or clipped at 0 (positive) |
| Illumination level | peak counts → QC signal check |

Sensor temperature is **not** simulated: there is no temperature term in the existing model with a
measurable consequence, so a slider would be decorative.

## 7. Wavelength calibration

`simulateWavelengthCalibration()` places the four CFL reference lines (435.83, 546.07, 611.20,
631.00 nm) on the twin sensor using the grating geometry. It perturbs the operator's peak picks
(pixel noise, a missing line), optionally moves the spectrum after calibration, and fits
λ = a·p + b with the production `fitWavelengthCalibration`. It reports the residuals, R², and the
worst wavelength error over 400–700 nm against the true geometry.

## 8. Views

| Route | What it is |
|---|---|
| `#/lab` | **Simulation Lab.** Parameters, presets (Clean / Realistic / Hard / Extreme / Unknown), 9 hero scenarios, reaction play / pause / scrub, and six chain panels: chemistry → I₀/I → sensor strip → A(λ) measured vs true → model + QC/OOD → result. Also chain replay, parameter sweeps and the wavelength-calibration lab. |
| `#/twin` | 3D Digital Twin (existing). Now runs on `SimulationState`. |
| `#/twin?hero=HERO_TURBID` | Opens a hero scenario in 3D with the **same seed** as the lab. |
| `#/twin?cfg=<json>` | Opens the lab's current configuration in 3D (lab button "Open in 3D twin"). |
| `#/twin?cinema=1&autoplay=1` | **Cinematic mode.** Developer controls hidden; the 15-step jury story (~78 s) plays from a fixed seed. |
| `#/twin?cinema=1&scene=<name>` | Holds on one scene for recording: `device, explode, led, cuvette, slit, grating, camera, optics, dispersion, sensor, spectrum, compute, result, unknown, rejection`. The scene is reached by replaying the story steps, so the state is exactly what the story produces. |

Model reasoning is shown only as real pipeline quantities: the Beer–Lambert and Ridge estimates,
grouped-CV RMSE, selected model, OOD distance, each QC check, uncertainty, and the model band.
Nothing is presented as "AI thoughts".

Timeline labels in the lab's chain replay (000–400 ms) are **conceptual** and marked as such. The
real pipeline time is shown separately as "Pipeline time (real)".

## 9. Hero scenarios

The 9 hero scenarios, with fixed seeds and computed outcomes, are in `LISA_SIMULATION_SCENARIOS.json`
(regenerated by `npm run test:sim`). Each scenario scripts only its inputs and story; the prediction,
QC, OOD and uncertainty are computed on every run.

## 10. Provenance rules

- Every `SimulationState` carries `provenance.kind = 'SIMULATED'`, its seed and `lisa-sim-2.0`, and
  its pipeline record has `sourceMode: 'SIMULATED'` (test 18).
- The Lab and Twin show a "Simulated" pill and a disclaimer on every screen.
- Illustrative constants (kinetic rates, interferent shapes, device curves, stray-light levels) are
  labelled as approximations here and in the UI.
