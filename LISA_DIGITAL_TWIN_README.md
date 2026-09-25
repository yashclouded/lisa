# LISA Digital Twin

An interactive, physically grounded 3D simulation of the LISA instrument and its measurement chain.
Open it from the highlighted **Digital twin · 3D** button in the main header, or go to `/#/twin`. The same 3D attachment (without the phone) also appears in **More → Hardware design**, where it opens assembled and then explodes.

> **Everything on this page is SIMULATED.** The page says so in its header, on the phone screen, on the stage readout, on the result card and in the footer. None of it is an experimental measurement.

---

## 1. Architecture

```
Controls (sliders, presets, faults, device)
        │  SimulationParams
        ▼
src/engine/simulator.ts  simulateSpectrum(params, new SeededPRNG(seed))   ← production, unchanged
        │  blankIntensities[151], sampleIntensities[151]
        ▼
src/engine/orchestrator.ts  executeLISAPipeline(...)                      ← production, unchanged
        │  alignment → absorbance → baseline → Beer–Lambert + Ridge → selection → OOD → QC → uncertainty
        ▼
TwinMeasurement { id, seed, params, sim, result }
        │
        ├── TwinScene (three.js): LED state, liquid colour, beam tint, dispersion fan, sensor image, phone screen
        ├── Measurement chain (9 stages, each showing a value from `result`)
        ├── From photon to number: sensor row → I(λ) → A(λ) → model → number
        ├── SpectrumViewer (the existing app component, unchanged)
        └── Result card + technical view
```

| File | Role |
|---|---|
| `src/digitalTwin/twinModel.ts` | The only glue. Grating optics, colour helpers, scenarios, faults, and `runTwinMeasurement()`, which calls the production simulator and pipeline. |
| `src/digitalTwin/TwinScene.ts` | Imperative three.js scene: geometry, materials, light path, explode/cutaway, camera presets, picking, labels, disposal. It computes no chemistry. |
| `src/digitalTwin/DigitalTwin.tsx` | The page: controls, result, chain, photon-to-number panel, technical view and jury mode. |
| `src/digitalTwin/digitalTwin.css` | Styles scoped under `.twin`, built on the existing `lisa.css` tokens. |
| `src/digitalTwin/twinInfo.ts` | Display helpers shared by the page and the hardware viewer (part explanations, analyte lookup, raw absorbance for refused analytes). |
| `src/digitalTwin/HardwareViewer.tsx` | Phone-less 3D attachment for the Hardware design modal (lazy-loaded). |
| `src/Root.tsx` | Hash route: `#/twin` lazy-loads the twin, anything else renders `App`. |
| `scripts/verify-digital-twin.ts` | Checks (`npm run test:twin`), and generates `LISA_DIGITAL_TWIN_SCENARIOS.json` when run with `--write`. |

**Shared files touched (small edits only):** `src/main.tsx` (renders `Root`), `src/components/Header.tsx` (highlighted Digital twin button), `src/components/HardwareRoadmapModal.tsx` (embeds the lazy 3D viewer), `src/styles/lisa.css` (one `.btn--feature` style), `package.json` (`three`, `@types/three`, `test:twin` script), and `src/engine/simulator.ts` (additive: a `lead` chromophore; existing outputs are byte-identical, and the golden tests still pass).

**Library choice.** I used plain `three` (plus its bundled `examples/jsm` addons: OrbitControls, CSS2DRenderer, RoomEnvironment, RoundedBoxGeometry) and **did not use React Three Fiber or Drei**. The scene is about 60 low-poly meshes driven by a handful of state setters, so an imperative class is simpler than a reconciler. That choice avoids two dependencies and React 19 / R3F version coupling. The twin is a lazy chunk (≈156 kB gzip), so the main app bundle does not grow.

## 2. Physical assumptions (from the build plan, `agent.md`)

| Element | Value used | Source |
|---|---|---|
| Illumination | White LED + opal diffuser | plan BOM |
| Cuvette | 12.5 mm outer, **10 mm path**, 45 mm tall | plan §Cuvette Chamber |
| Chamber | 14 mm inner cavity | plan step 3 |
| Slit | twin razor blades, 0.1–0.2 mm gap (**drawn ×2 wider** so it is visible) | plan step 4 |
| Tube | 30 × 30 mm, ≈110 mm to the phone | plan step 2 |
| Grating | **1000 lines/mm** film taped over the phone lens | plan step 6 |
| Wedge | α₀ = asin(550/1000) = **33.4°**, so 550 nm lands mid-sensor | plan step 7 |

**Optics model.** Light arrives at the grating at incidence −α₀. The first-order grating equation, measured from the camera axis, is `sin θ = λ/d − sin α₀`. The lens is treated as a pinhole, so a wavelength lands at `x = f·tan θ`. This gives 450 nm → −5.7°, 550 nm → 0°, 650 nm → +5.7°.

**Wavelength calibration, done as it would be on hardware.** The CFL reference lines (Hg 435.8, Hg 546.1, Eu 611.2, Eu 631.0 nm) are placed on a 1000-column sensor using the model above. The **production** `fitWavelengthCalibration` then fits `λ(p) = 0.3333·p + 383.67 nm` (R² ≈ 1, residual 0.08 nm). The small residual is real: it is the non-linearity of the grating and lens geometry.

## 3. Simulation assumptions and honesty notes

- **What is numerical and real:** every number (intensities, absorbance, prediction, uncertainty, QC, OOD, model choice, detected shift) comes from `simulateSpectrum` + `executeLISAPipeline`, unchanged.
- **The simulator works on a 151-point, 2 nm grid, not on pixels.** The sensor image in the twin is a *rendering* of the simulated I(λ) at positions set by the grating geometry. It is not a simulated camera frame, and the simulator does not model image formation, slit width, stray light or diffuser uniformity.
- **Ray paths are an explanatory approximation**, not an electromagnetic or ray-traced simulation. Beam colour after the cuvette is the LED spectrum × simulated T(λ), projected to RGB. Fan opacity per wavelength is the simulated sensor intensity at that wavelength.
- **Visual exaggerations, all deliberate and listed here:** the slit gap is drawn ×2; the liquid colour is the physical transmitted colour *squared*, which deepens it for visibility (the hue is physical, the depth is not); in exploded view the image plane is drawn at the exploded focal distance, so the image scales with it, as a pinhole image would.
- **Determinism.** Each measurement is seeded with `LISA-TWIN-<run>`. Moving a slider keeps the seed, so you see the effect of the chemistry and not a new noise draw. **Run measurement** and **New noise realisation** increment the run, which changes the ID (`SIM-<conc×1000>-<run>`, e.g. `SIM-0400-002`).
- **Ground truth** ("Simulated truth", "Error vs truth") is shown because in a simulation it is known. It is passed to the pipeline only as the `groundTruth` annotation and never influences inference.

### Lead (Pb²⁺)

**Chemistry in the cuvette** can be set to Phosphate, Lead or Unknown dye. Lead is simulated as lead dithizonate: λmax ≈ 520 nm, FWHM ≈ 80 nm, ≈0.33 AU per mg Pb/L per cm (ε ≈ 6.9×10⁴ L·mol⁻¹·cm⁻¹ ÷ 207.2 g/mol). The measurement is declared to the pipeline as `lead`. LISA has no lead calibration, so the production pipeline refuses (`UNSUPPORTED_ANALYTE`) at every concentration. The twin then plots the raw −log₁₀(I/I₀) from the production `computeAbsorbance` and labels it as raw. At the 0.01 mg/L IS 10500 limit the signal is ≈0.003 AU, below a phone's noise floor without pre-concentration. The slider runs to 2 mg/L so that the pink complex becomes visible.

## 4. 3D model structure

Parts (each one is clickable, labelled, and has an explanation with live values): **Enclosure** (chamber + tube + wedge, matte black card, clipped in cutaway), **White LED** (emissive + point light when on), **Diffuser**, **Sample cuvette** (glass + liquid tinted from simulated T(λ)), **Slit** (steel blades), **Diffraction grating** (iridescent film, normal = camera axis), **Image plane** (textured with the simulated sensor row), **Phone camera** (body, lenses, and a screen that shows the twin's own result).

- **Modes:** Assembled / Cutaway (a clip plane sweeps away the front half of the enclosure) / Exploded (parts move along the optical axis; after the grating they move along the camera axis; the enclosure drops below).
- **Cameras:** Front, Top, Side, Optical path, Sensor ("see through the phone": the phone ghosts to 14 % and wavelength ticks at 450–700 nm appear). Orbit, zoom and pan work at any time; the first drag switches to a free camera.
- **Performance:** no shadow maps, no post-processing, no particles. Light "travel" is a sine modulation in two tiny shaders. The contact shadow is a gradient texture. The pixel ratio is capped (1.5 on narrow screens). Dispose releases geometries, materials, textures and the GL context. Switching routes four times left exactly one canvas and no console output.

## 5. Controls

- **Presets:** Clean sample · Noisy sample · Turbid water · Misaligned cuvette · Saturated sensor · Unknown chemistry.
- **Sliders:** phosphate 0–1.50 mg P/L (calibrated max 1.00 marked), noise, cuvette shift, turbidity, device profile. **Advanced:** humic colour, illumination drift, saturation, new noise realisation.
- **Break the measurement:** toggleable faults layered on the current parameters (excess noise, severe shift, saturation, strong turbidity, humic colour, unknown dye).
- **Blank I₀ / Sample I** toggle: switches the cuvette, the beam tint, the fan, the sensor row and the plots between the blank and the sample. It also shows the worked `A = −log₁₀(I/I₀)` at 676 nm, computed with the production `computeAbsorbance`, next to the pipeline's baseline-corrected value.
- **Technical view** (collapsed by default): range, points, peak, device, applied/detected shift, all QC checks, OOD, model, prediction, uncertainty, grating, sensor calibration and pipeline time.

## 6. Jury mode (~75 s, 15 steps)

Device → exploded → LED → cuvette → slit → grating → phone → light on (cutaway) → dispersion → sensor view → spectrum (scrolls to photon-to-number) → compute (a real run) → result → unknown dye (a real run) → rejection.

**Pause / Continue**, **Step**, **Exit**; the keyboard also works (Space, →, Esc). Captions for the result and rejection steps are built from the live `TwinMeasurement`, so they state whatever the engine returned. With the default seed the run gives **0.394 ± 0.204 mg P/L, QC pass, in distribution**, followed by **"LISA REFUSED TO REPORT A NUMBER: Sample optical signature is outside the validated calibration manifold."**

## 7. Deterministic scenarios (`LISA_DIGITAL_TWIN_SCENARIOS.json`)

These are recorded from the engine by `npm run test:twin -- --write`, and `npm run test:twin` fails if the engine's output drifts.

| Scenario | Engine output (run 1) |
|---|---|
| clean_phosphate | 0.395 mg P/L, QC PASS, in distribution |
| noisy_sample | 0.405, QC PASS (uncertainty widens) |
| turbid_sample | **0.253**, QC PASS, in distribution: see limitation 1 |
| misaligned_sample | REJECTED: QC shift FAIL |
| lead_sample | REJECTED: uncalibrated analyte (pipeline refuses) |
| saturated_sample | REJECTED: QC saturation FAIL |
| unknown_dye | REJECTED: OUT_OF_DISTRIBUTION |

## 8. Limitations and engine findings (surfaced, not hidden)

The twin made some behaviours of the production engine visible. I did not change the engine, because another agent owns it. These should be triaged:

1. **Turbidity and humic colour bias the result low without rejection.** At turbidity 0.40 AU and true 0.40 mg P/L, the engine reports 0.253 with QC PASS and in distribution. At humic colour 0.6 AU it reports ≈0.10 with only an advisory. These are silent under-reads. The twin shows them honestly, with the error against truth.
2. **A true 0.00 mg/L blank is rejected as out-of-distribution** (OOD score ≈3.5). A flat absorbance spectrum has an undefined shape correlation, so the OOD shape penalty fires. Values ≥ 0.02 mg/L are accepted.
3. **The alignment step reports a −1 px shift on a perfectly aligned sample**, and an applied +3 px is detected as −4 px. The sign convention and the one-pixel bias look off in `alignment.ts` or in the simulator's shift direction.
4. **Uncertainty is wide** (≈ ±0.20 mg P/L at 0.40). That is what `uncertainty.ts` reports, and the twin shows it unmodified.
5. The 3D geometry is a simplified model of the build plan, not CAD. Slit width, stray light, lens aberration, sensor Bayer pattern, rolling shutter and diffuser uniformity are **not** modelled.
6. The twin always runs the phosphate calibration. For "Unknown chemistry", the cuvette holds the simulator's `anomaly` chromophore and LISA still assumes phosphate, which is exactly the situation that OOD must catch.
7. The twin chunk is ≈600 kB minified (three.js), so Vite prints a chunk-size advisory. It loads only when `#/twin` is opened.

## 9. Verification

| Check | Result |
|---|---|
| `npm run build` | passes (tsc + vite) |
| `npm run lint` | 0 errors; 4 warnings, all pre-existing in `Status.tsx` / `PipelineVisualizer.tsx` |
| `npm test` | 21 / 21 pass |
| `npm run test:twin` | passes: twin output is identical to calling the production functions directly; deterministic; noise, turbidity, shift and device each change pipeline output; dye, saturation and shift are rejected by the pipeline; optics round-trip; blank transmits white; scenario golden file matches |
| Browser (dev server) | renders; orbit, explode, cutaway, sensor view, picking, run animation and full jury mode checked; 375 px mobile layout checked (no horizontal scroll); no console errors |
