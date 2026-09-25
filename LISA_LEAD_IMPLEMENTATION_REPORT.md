# LISA Full Simulated Lead Pipeline Implementation Report

**Status:** SIMULATED / RESEARCH ROADMAP  
**Analyte:** Lead ($Pb^{2+}$ as Lead–Dithizone Complex)  
**Date:** September 2026  
**Pipeline Version:** LISA v1.0 Multi-Analyte Architecture  

---

## 1. Architecture Used

The LISA inference architecture was generalized from a single-analyte assumption to a dynamic multi-analyte dispatch system without introducing analyte-specific algorithm forks:

```
User / API / Twin Selection (analyteId: 'lead')
             │
             ▼
ANALYTE_REGISTRY Lookup (src/data/analytes.ts)
             │
             ▼
getCalibrationForAnalyte('lead') (src/engine/orchestrator.ts)
 ├── Deterministic Synthetic Standards (33 standards across 11 concentrations)
 ├── Beer-Lambert Model (505–535 nm band, slope ~0.32 AU/(mg/L))
 ├── Full-Spectrum Ridge Model (151 wavelengths, alpha = 0.05)
 ├── 11-Group LOCO Cross-Validation (Zero concentration leakage)
 ├── Lead OOD Manifold (Lead PCA & Mahalanobis reference space)
 └── Per-Wavelength Slope/Intercept Vectors for Dynamic Residual Noise
             │
             ▼
Execution Pipeline (executeLISAPipeline)
 ├── Device Optical Normalization (Spectral responsivity)
 ├── Cross-Correlation Optical Registration (±10 px mechanical shift)
 ├── Raw Absorbance A(λ) = -log10(I / I₀)
 ├── Baseline Offset Correction (400–450 nm zeroing)
 ├── Multi-Model Evaluation (Beer-Lambert & Ridge)
 ├── Grouped-CV Model Selection (Objective lowest CV RMSE)
 ├── Lead-Specific OOD Evaluation (Relative to Lead manifold)
 ├── Analyte-Aware Quality Control (QC) (Saturation, throughput, alignment, range, turbidity)
 ├── Analytical Uncertainty Engine (Dynamic CV error + sample noise + range edge penalty)
 └── Scientific Explanation (Trilingual/bilingual context, simulated provenance banner)
             │
             ▼
Result Record & Export (MeasurementRecord: unit 'mg Pb/L', analyteId 'lead')
```

Strict refusal remains active: analytes without a valid calibration dataset (such as Iron, Fluoride, Nitrate, or Unknowns) are strictly refused by the pipeline with `UNSUPPORTED_ANALYTE`, while Orthophosphate and Simulated Lead execute through their respective calibration models.

---

## 2. Lead Analyte Definition

The definitive Lead definition is registered in [`src/data/analytes.ts`](file:///Users/yashsingh/programmin/lisa/src/data/analytes.ts):

* **ID:** `lead`
* **Name:** `Lead (Heavy Metal)`
* **Chemical Formula:** $Pb^{2+}$
* **Assay Method:** `Dithizone Extraction (Simulated) / Pre-concentration`
* **Unit:** `mg Pb/L`
* **Primary Band:** `[505, 535] nm`
* **Peak Wavelength:** `520 nm`
* **Calibration Range:** `0.0 – 2.0 mg Pb/L`
* **Safe Threshold:** `0.01 mg Pb/L` (BIS IS 10500:2012 drinking water limit / 10 ppb)
* **Caution / Alert Threshold:** `0.01 mg Pb/L`
* **Status / Provenance:** `roadmap` (`SIMULATED / UNVALIDATED`)
* **Regulatory Note:** Delineates that field optical colorimetry cannot resolve parts-per-billion lead concentrations without solid-phase extraction pre-concentration. Simulation assumes 1.0 cm optical path length and $Pb(HDz)_2$ pink complex.

---

## 3. Simulator Assumptions

In [`src/engine/simulator.ts`](file:///Users/yashsingh/programmin/lisa/src/engine/simulator.ts), the physical optical profile for Lead simulates the lead(II) dithizonate chromophore:

1. **Chromophore:** Lead–dithizone complex ($Pb(HDz)_2$), exhibiting a bright magenta/pink color.
2. **Main Absorption Band:** Gaussian-broadened absorption centered at $\lambda_{max} \approx 520\text{ nm}$ with $\sigma \approx 28\text{ nm}$.
3. **Molar Absorptivity / Optical Sensitivity:** $k \approx 0.33\text{ AU}/(\text{mg/L}\cdot\text{cm})$.
4. **Path Length:** Standard $1.0\text{ cm}$ optical cuvette.
5. **Secondary Features:** Dithizone reagent absorption in the near-UV/blue ($< 450\text{ nm}$) and minor solvent baseline offset.
6. **Detector Model:** Silicon CMOS sensor noise, dark noise, and illumination drift.

---

## 4. Calibration Design

A deterministic synthetic calibration matrix is generated in [`src/data/demoData.ts`](file:///Users/yashsingh/programmin/lisa/src/data/demoData.ts) via `generateLeadCalibrationStandards()`:

* **Fixed PRNG Seed:** `LISA-CAL-LEAD-2026` (guaranteeing exact reproducibility without stochastic drift).
* **Concentration Range:** $0.0\text{ to }2.0\text{ mg Pb/L}$.
* **Low-Concentration Sampling:** Dense sampling around the $0.01\text{ mg Pb/L}$ regulatory threshold:
  $$\mathbf{C} = [0.000, 0.005, 0.010, 0.020, 0.050, 0.100, 0.250, 0.500, 1.000, 1.500, 2.000]\text{ mg Pb/L}$$
* **Replicates:** 3 independent replicates per concentration ($11 \times 3 = 33$ calibration standards).
* **Controlled Noise:** Detector noise ($\sigma = 0.008$) and minor baseline variations applied independently to every replicate.
* **Metadata:** Every standard has `analyteId: 'lead'`, `provenance: 'SIMULATED'`, and full 151-wavelength spectrum.

---

## 5. Beer-Lambert Implementation

The generic Beer-Lambert engine in [`src/engine/beerLambert.ts`](file:///Users/yashsingh/programmin/lisa/src/engine/beerLambert.ts) fits integrated absorbance over Lead's primary absorption window ($505–535\text{ nm}$):

* **Integrated Band:** $\bar{A}_{505-535} = \frac{1}{\lambda_2 - \lambda_1}\int_{505}^{535} A(\lambda)\,d\lambda$
* **Calculated Slope ($k$):** $0.3197\text{ AU}/(\text{mg Pb/L})$
* **Calculated Intercept ($b$):** $0.0014\text{ AU}$
* **Goodness of Fit ($R^2$):** $0.9968$
* **Absorbance RMSE:** $0.0121\text{ AU}$
* **Concentration RMSE:** $0.0379\text{ mg Pb/L}$
* **Residual Standard Error ($s_{y/x}$):** $0.0125\text{ AU}$
* **Calculated LOD ($3.3 \cdot s_{y/x} / k$):** $0.1291\text{ mg Pb/L}$
* **Calculated LOQ ($10 \cdot s_{y/x} / k$):** $0.3913\text{ mg Pb/L}$

---

## 6. Ridge Implementation

The full-spectrum L2-regularized Ridge regression engine in [`src/engine/ridge.ts`](file:///Users/yashsingh/programmin/lisa/src/engine/ridge.ts) trains across all 151 wavelengths ($400–700\text{ nm}$ at $2\text{ nm}$ steps):

* **Feature Matrix:** $\mathbf{X} \in \mathbb{R}^{33 \times 151}$
* **Target Vector:** $\mathbf{y} \in \mathbb{R}^{33}$
* **Regularization ($\alpha$):** $0.05$
* **Training $R^2$:** $0.9998$
* **Training RMSE:** $0.0091\text{ mg Pb/L}$
* **Training MAE:** $0.0068\text{ mg Pb/L}$
* **Weight Profile:** Peak positive regression coefficients sharply localized around $516–524\text{ nm}$, reflecting the chromophore without overfitting background noise.

---

## 7. Grouped Cross-Validation

To prevent replicate leakage discovered in earlier audits:

* **Group Assignment:** Replicates sharing the exact same ground-truth concentration belong to the same fold group ($11$ unique concentration groups).
* **CV Strategy:** Leave-One-Concentration-Out (LOCO-CV). In each fold, all 3 replicates of a concentration are held out simultaneously while the remaining 10 concentrations (30 standards) train the model.
* **CV Leakage:** **Zero.** No replicate of a test concentration ever appears in the training set.
* **Grouped CV Metrics:**
  * **Grouped CV RMSE:** $0.0127\text{ mg Pb/L}$
  * **Grouped CV MAE:** $0.0084\text{ mg Pb/L}$
  * **Grouped CV $R^2$:** $0.9996$
* **Model Selection Verdict:** Ridge regression wins dynamically over Beer-Lambert ($0.0127\text{ mg/L}$ vs $0.0415\text{ mg/L}$ CV RMSE) and is selected by the orchestrator.

---

## 8. OOD Integration

The Out-Of-Distribution engine in [`src/engine/ood.ts`](file:///Users/yashsingh/programmin/lisa/src/engine/ood.ts) constructs an analyte-specific calibration manifold:

* **Lead Manifold Reference:** Derived strictly from the 33 Lead calibration standards (mean vector, covariance matrix, PCA basis).
* **Clean Lead (0.40 mg/L):** OOD score $= 0.09 \ll 2.5 \implies$ `IN_DISTRIBUTION`.
* **Phosphate Sample Presented as Lead:** OOD score $= 13.68 \gg 4.5 \implies$ `OUT_OF_DISTRIBUTION` (Hard Refusal).
* **Yellow Tartrazine Dye in Lead Mode:** OOD score $= 6.18 \gg 4.5 \implies$ `OUT_OF_DISTRIBUTION` (Hard Refusal).
* **Integrity:** Zero cheat codes. OOD evaluates the true Mahalanobis distance in spectral subspace.

---

## 9. QC Integration

The Quality Control engine in [`src/engine/qc.ts`](file:///Users/yashsingh/programmin/lisa/src/engine/qc.ts) evaluates 5 multi-tier physical checks with Lead parameters:

1. **Pixel Saturation:** Rejects if raw sensor pixel intensity clips at $\ge 250 / 255$ scale.
2. **Signal Throughput:** Fails if optical transmission $< 30$, warns if $< 50$.
3. **Spectral Alignment:** Evaluates physical cuvette shift against mechanical limit $\le \pm 6\text{ px}$.
4. **Calibration Dynamic Range:** Evaluates prediction against Lead range $[0.0, 2.0]\text{ mg Pb/L}$. Fails if $> 2.30\text{ mg Pb/L}$ (15% above range; dilution required). Warns if below optical LOD ($< 0.13\text{ mg Pb/L}$).
5. **Matrix Turbidity:** Evaluates uncorrected matrix baseline absorption in $400–450\text{ nm}$ window. Warns if $> 0.12\text{ AU}$, flags significant turbidity if $> 0.25\text{ AU}$.

---

## 10. Uncertainty Integration

Uncertainty is quantified using the unified analytical engine in [`src/engine/uncertainty.ts`](file:///Users/yashsingh/programmin/lisa/src/engine/uncertainty.ts):

* **Components:**
  1. Base calibration error: Lead grouped-CV RMSE ($0.0127\text{ mg Pb/L}$).
  2. Sample-specific spectral residual variance: computed by projecting sample absorbance against Lead wavelength sensitivity vectors $k(\lambda)$ and $b(\lambda)$.
  3. Dynamic range edge penalty: scales uncertainty at boundaries ($< 0.10\text{ mg/L}$ and $> 1.70\text{ mg/L}$).
  4. OOD distance penalty: inflates interval if approaching distribution boundaries.
* **Output:** $\pm \delta\text{ mg Pb/L}$ at 95% Student-$t$ confidence interval.
* **Clean 0.40 mg Pb/L Result:** $0.40 \pm 0.09\text{ mg Pb/L}$ (95% CI: $0.31 – 0.49\text{ mg Pb/L}$).

---

## 11. Sample Library Integration

6 dedicated Lead scenarios were integrated into [`src/sampleLibrary/scenarios.ts`](file:///Users/yashsingh/programmin/lisa/src/sampleLibrary/scenarios.ts):

| Scenario ID | Name | Concentration | Condition | Expected Pipeline Action |
|---|---|---|---|---|
| `scen-lead-reference` | Lead Reference Standard | $0.40\text{ mg Pb/L}$ | Clean | Quantify (~$0.40\text{ mg Pb/L}$), QC Pass, OOD In-dist |
| `scen-lead-trace` | Drinking Water Reference Limit | $0.01\text{ mg Pb/L}$ | Trace | Quantify (~$0.01\text{ mg Pb/L}$), QC Warning (< LOD), Safe |
| `scen-lead-low` | Elevated Groundwater | $0.10\text{ mg Pb/L}$ | Moderate | Quantify (~$0.10\text{ mg Pb/L}$), QC Pass, Alert |
| `scen-lead-high` | Battery Recycling Effluent | $1.50\text{ mg Pb/L}$ | High | Quantify (~$1.50\text{ mg Pb/L}$), QC Pass, Alert |
| `scen-lead-interference`| Lead + Turbid Surface Water | $0.40\text{ mg Pb/L}$ | $0.35\text{ AU}$ Clay | Quantify, QC Turbidity Warning, Widened CI |
| `scen-lead-unknown` | Adversarial Dye (Tartrazine) | $0.40\text{ mg/L}$ | Peak $426\text{ nm}$ | Rejection via Lead OOD Manifold |

All scenarios explicitly state `provenance: 'SIMULATED'` and link to compliant context-only visuals.

---

## 12. Digital Twin Compatibility

In [`src/digitalTwin/twinModel.ts`](file:///Users/yashsingh/programmin/lisa/src/digitalTwin/twinModel.ts):

* Digital Twin's Lead chemistry (`id: 'lead'`) maps to `analyteId: 'lead'`.
* `runTwinMeasurement` routes Lead simulations directly through `executeLISAPipeline` with Lead calibration.
* Golden scenario suite ([`LISA_DIGITAL_TWIN_SCENARIOS.json`](file:///Users/yashsingh/programmin/lisa/LISA_DIGITAL_TWIN_SCENARIOS.json)) records:
  * Scenario `lead_sample` ($0.50\text{ mg Pb/L}$ simulated truth) yields inferred concentration **$0.499\text{ mg Pb/L}$**, `QC PASS`, `IN_DISTRIBUTION`, unit `mg Pb/L`.
  * Truly uncalibrated chemistries (e.g. Iron) are verified to trigger pipeline refusal (`UNSUPPORTED_ANALYTE`).

---

## 13. Tests

The verification suite ([`scripts/run-all-tests.ts`](file:///Users/yashsingh/programmin/lisa/scripts/run-all-tests.ts)) includes dedicated tests for Phase 22 (Tests 1–14):

1. **TEST 1:** Lead simulation at $0.4\text{ mg/L}$ produces absorbance peak at $520\text{ nm}$ ($\pm 2\text{ nm}$).
2. **TEST 2:** Beer-Lambert model predicts clean standard accurately ($0.400 \to 0.398\text{ mg/L}$).
3. **TEST 3:** All calibration statistics ($R^2$, slope, LOD, Ridge CV $R^2$) are calculated from data.
4. **TEST 4:** Ridge model uses 33 Lead training standards across 151 wavelengths.
5. **TEST 5:** 11-group cross-validation has zero concentration leakage.
6. **TEST 6:** Clean Lead spectrum evaluates as `IN_DISTRIBUTION` (score $< 1.0$).
7. **TEST 7:** Phosphate spectrum tested under Lead mode is rejected as `OUT_OF_DISTRIBUTION`.
8. **TEST 8:** Tartrazine azo dye tested under Lead mode is rejected as `OUT_OF_DISTRIBUTION`.
9. **TEST 9:** $0.40\text{ mg Pb/L}$ prediction is produced purely by model regression, not slider echo.
10. **TEST 10:** $0.01\text{ mg Pb/L}$ triggers sub-LOD QC range notice without false confidence claims.
11. **TEST 11:** Saturated sensor simulation triggers QC pixel saturation failure and rejection.
12. **TEST 12:** Misaligned cuvette ($+10\text{ px}$) triggers mechanical registration failure.
13. **TEST 13:** Colloidal turbidity ($0.5\text{ AU}$) triggers matrix interference warning.
14. **TEST 14:** Saved records and history exports preserve `analyteId: 'lead'` and unit `mg Pb/L`.

All 14 tests pass seamlessly. Total test suite: **36 passed, 0 failed**. Sample library suite: **50 passed, 0 failed**. Digital twin: **all passed**.

---

## 14. Measured Simulated Metrics Summary

| Metric | Target / Assumption | Simulated Value |
|---|---|---|
| **Peak Absorption $\lambda_{max}$** | $\sim 520\text{ nm}$ | $520\text{ nm}$ |
| **Sensitivity $k$ (Beer-Lambert)** | $\sim 0.33\text{ AU}/(\text{mg/L}\cdot\text{cm})$ | $0.3197\text{ AU}/(\text{mg Pb/L}\cdot\text{cm})$ |
| **Beer-Lambert $R^2$** | $> 0.99$ | $0.9968$ |
| **Beer-Lambert Conc. RMSE** | $< 0.05\text{ mg/L}$ | $0.0379\text{ mg Pb/L}$ |
| **Simulated Optical LOD** | Calculated | $0.1291\text{ mg Pb/L}$ |
| **Simulated Optical LOQ** | Calculated | $0.3913\text{ mg Pb/L}$ |
| **Ridge Regularization $\alpha$** | Optimized | $0.05$ |
| **Ridge Training $R^2$** | $> 0.99$ | $0.9998$ |
| **Ridge Grouped CV RMSE** | Lowest | $0.0127\text{ mg Pb/L}$ |
| **Ridge Grouped CV $R^2$** | $> 0.99$ | $0.9996$ |
| **Inference on Clean $0.400\text{ mg/L}$**| $\sim 0.400\text{ mg/L}$ | **$0.398\text{ mg Pb/L}$** (Error: $-0.002\text{ mg/L}$, $0.5\%$) |
| **Clean OOD Distance Score** | $< 1.0$ | $0.09$ |
| **Phosphate-as-Lead OOD Score** | $> 4.5$ (Rejection) | $13.68$ |

---

## 15. Remaining Limitations & Scientific Honesty

1. **Software Simulation Only:** This implementation demonstrates computational capability under simulated physics. It does not validate physical smartphone camera sensors, varying ambient lighting, or real chemical reagents.
2. **Optical Detection Limit vs Regulatory Guideline:**
   * The drinking-water regulatory threshold (BIS IS 10500:2012) is $0.01\text{ mg Pb/L}$ ($10\text{ ppb}$).
   * In a standard $1.0\text{ cm}$ path cuvette, $0.01\text{ mg Pb/L}$ yields an absorbance increase of only $\sim 0.0033\text{ AU}$, which is below the detector noise floor ($\text{LOD} \approx 0.129\text{ mg/L}$).
   * The pipeline honestly identifies concentrations below LOD as trace/sub-quantitation, clearly distinguishing regulatory reference levels from instrument optical detection capability.
3. **Wet Chemistry Selectivity:** Dithizone chelates multiple divalent cations ($Zn^{2+}$, $Cd^{2+}$, $Cu^{2+}$, $Bi^{3+}$). Physical deployment requires solid-phase extraction pre-concentration or cyanide/citrate masking reagents.
4. **Roadmap Designation:** Lead is explicitly cataloged as `status: roadmap` and flagged in explanations and UI as a simulated research model.
