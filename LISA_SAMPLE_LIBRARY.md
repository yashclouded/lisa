# LISA Sample Library & Field Simulation Documentation

## Overview

The LISA Sample Library is a built-in repository of **14 environmental water scenarios**, physical optical dispersion models, and failure test cases. It allows operators, field technicians, and judges to simulate, test, and understand real-world water testing scenarios without compromising scientific honesty.

---

## Scientific Principles & Data Architecture

1. **Separation of Context and Measurement:**  
   A landscape photograph or close-up photo of a water body carries **zero spectral information** about orthophosphate concentration. LISA's data model strictly separates:
   - **Source Context Visual:** Illustrative or reference scene providing geographical and matrix context.
   - **Optical Measurement Input:** Physical transmission spectrum $I(\lambda)$ through a 1.0 cm optical path dispersed by a 1000 lines/mm transmission grating onto a CMOS sensor array across 400–700 nm.

2. **Zero Ground-Truth Leakage:**  
   Ground-truth concentration is **never** passed into the inference pipeline during live testing. The prediction shown to the operator is computed strictly from:
   $$A(\lambda) = -\log_{10}\left(\frac{I_{\text{sample}}(\lambda)}{I_{\text{blank}}(\lambda)}\right)$$
   followed by baseline correction, dual-model inference (Ridge & Beer-Lambert), multi-tier QC, and Mahalanobis Out-Of-Distribution gating.

3. **Deterministic Replayability:**  
   Every scenario is paired with a seeded pseudo-random number generator (e.g. `LISA-SCEN-AGR-005`). Replaying a measurement restores the exact optical parameters and reproduces identical numerical predictions to within $10^{-9}$ numerical tolerance.

---

## Scenario Catalog (14 Central Scenarios)

| # | ID | Name | Source Type | Category | Ground Truth | Expected Behavior | Provenance |
|---|---|---|---|---|---|---|---|
| 1 | `scen-tap-water` | Municipal Tap Water (Ashoka Cooler) | Municipal Supply | Drinking | 0.03 mg P/L | SAFE (<0.10 mg/L), QC PASS | SIMULATED |
| 2 | `scen-borewell-water` | Borewell / Deep Aquifer Groundwater | Groundwater | Groundwater | 0.08 mg P/L | SAFE (<0.10 mg/L), QC PASS | SIMULATED |
| 3 | `scen-village-pond` | Eutrophic Village Pond | Stagnant Surface | Surface | 0.45 mg P/L | ALERT (>0.10 mg/L), QC PASS | SIMULATED |
| 4 | `scen-stormwater-drain` | Sonipat Stormwater / Urban Drain | Urban Runoff | Effluent | 0.65 mg P/L | ALERT (>0.10 mg/L), QC PASS | SIMULATED |
| 5 | `scen-ag-runoff` | Agricultural Fertilizer Runoff (DAP Spiked) | Agricultural Drainage | Agricultural | 0.40 mg P/L | ALERT (>0.10 mg/L), QC PASS | SIMULATED |
| 6 | `scen-rainwater-tank` | Rooftop Rainwater Catchment Tank | Rainwater | Drinking | 0.01 mg P/L | SAFE (<0.10 mg/L), QC PASS | SIMULATED |
| 7 | `scen-ro-water` | Reverse Osmosis (RO) Laboratory Permeate | Laboratory Purified | Drinking | 0.00 mg P/L | SAFE (<0.10 mg/L), QC PASS | SIMULATED |
| 8 | `scen-turbid-surface` | Turbid River Water (Colloidal Clay) | Turbid Surface Water | Surface | 0.35 mg P/L | ALERT (>0.10 mg/L), Baseline Corr | SIMULATED |
| 9 | `scen-unknown-dye` | Unknown Chemistry: Food Dye (Tartrazine) | Adversarial Contaminant | Adversarial | 0.00 mg P/L | REJECTED (OOD Anomaly) | SIMULATED |
| 10 | `scen-saturated-sensor` | Hardware Fault: Saturated Sensor | Optical Hardware Fault | Hardware Fault | 0.20 mg P/L | REJECTED (QC Saturation Fail) | SIMULATED |
| 11 | `scen-misaligned-cuvette` | Hardware Fault: Cuvette Misalignment (+8px) | Mechanical Fault | Hardware Fault | 0.40 mg P/L | REJECTED (QC Shift Fail) | SIMULATED |
| 12 | `scen-industrial-overrange` | High-Strength Industrial Effluent | Industrial Discharge | Effluent | 1.85 mg P/L | ALERT (Over-Range, Dilution Req) | SIMULATED |
| 13 | `scen-uncalibrated-lead` | Uncalibrated Metal: Lead (Pb²⁺ Dithizone) | Unsupported Heavy Metal | Adversarial | 0.50 mg Pb/L | REJECTED (Analyte Dispatcher) | SIMULATED |
| 14 | `scen-dim-light` | Hardware Fault: Degraded Optical Flux | Optical Hardware Fault | Hardware Fault | 0.40 mg P/L | REJECTED (QC Signal Fail) | SIMULATED |

---

## Testing & Verification Tools

- **Single Scenario Runner:** `runSampleScenario(scenario, options)`
- **Batch Simulation:** `runBatchSimulation(options)`
- **Stress Matrix (144 Combinations):** `runStressMatrix(config)`
- **Blind Test Protocol:** `executeBlindVialTest(vial)`
- **Field Day Route:** `executeRouteStop(stopIndex)`
- **Failure Validator:** `validateFailureLibrary()`
- **Image Fixture Suite:** `evaluateImageFixture(fixture)`
- **Image Augmentations:** `runAugmentationStressTest()`
- **Robustness Fuzzing:** `runRobustnessTestSuite()`

To run the automated verification command:
```bash
npm run test:lisa
```
