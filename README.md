# LISA: Light-based In-field Spectral Analyser
> **Computational sensing runtime turning frugal smartphone optics into an objective, calibrated water chemistry lab.**

[![Event](https://img.shields.io/badge/Event-Ashoka%20Startup%20Challenge-00D2D3)](https://ashoka.edu.in)
[![Scientific Foundation](https://img.shields.io/badge/Scientific%20Paper-Sensors%20%26%20Actuators%20B%20(2026)-10AC84)](https://doi.org/10.1016/j.snb.2026.140011)
[![Regulatory Reference](https://img.shields.io/badge/Water%20Standards-BIS%20IS%2010500%20%2F%20US%20EPA-FFA502)](#)
[![Status](https://img.shields.io/badge/Prototype%20Build-Passing%20(100%25%20Offline)-brightgreen)](#)

---

## 1. What is LISA?

**LISA (Light-based In-field Spectral Analyser)** is a frugal, Foldscope-style smartphone spectrometer and software-defined computational sensing platform.

- **The Problem:** Over 2.1 billion people lack safely managed drinking water. India's Jal Jeevan Mission (JJM) has trained 24.8 lakh rural women using Field Testing Kits (FTKs). However, current FTKs rely on human visual color matching against paper charts—results are subjective, lighting-dependent, officially only "indicative", and leave zero digital audit trail.
- **The LISA Solution:** A clip-on origami card enclosure ($30 \times 30\text{ mm}$ optical tube, dual razor-blade entrance slit, transmission diffraction grating film) combined with an offline-first, physics-informed machine learning runtime that measures absorption ($400–700\text{ nm}$), extracts analyte concentrations via Beer-Lambert / Ridge Regression models, checks against Bureau of Indian Standards (IS 10500:2012) drinking water limits, provides multilingual voice readouts (Hindi & English), and logs geotagged results.

---

## 2. Scientific Principles & Mathematical Foundation

Spectrometric concentration determination in LISA relies on the Beer-Lambert Law:
$$A(\lambda) = -\log_{10}\left(\frac{I_{\text{sample}}(\lambda)}{I_{\text{blank}}(\lambda)}\right) = \varepsilon(\lambda) \cdot \ell \cdot c$$

Where:
- $A(\lambda)$: Optical absorbance at wavelength $\lambda$
- $I_{\text{sample}}(\lambda)$: Transmitted light intensity through sample
- $I_{\text{blank}}(\lambda)$: Transmitted light intensity through reagent blank
- $\varepsilon(\lambda)$: Molar absorptivity of chromophore ($L \cdot \text{mol}^{-1} \cdot \text{cm}^{-1}$)
- $\ell$: Optical path length ($10\text{ mm}$ standard cuvette)
- $c$: Analyte concentration ($\text{mg P/L}$)

### Flagship Analyte: Orthophosphate (Molybdenum Blue)
- **Standard Reference:** US EPA Method 365.3 / Murphy & Riley (1962)
- **Chromophore:** 12-molybdophosphoric acid reduced with ascorbic acid to form molybdenum blue ($A_{\text{peak}} \sim 675–690\text{ nm}$ in the visible spectrum).
- **Tracer Role:** Clean groundwater contains negligible phosphorus ($<0.05\text{ mg/L}$). Elevated levels indicate raw domestic sewage, agricultural fertilizer runoff (DAP), or industrial detergent intrusion.

---

## 3. Computational Architecture & Intelligence Layer

```
Sample / Optical Input (Simulator / Camera / Upload)
      ↓
Acquisition & Computer-Vision ROI Extraction
      ↓
Cross-Correlation Spectral Alignment (±10 px drift correction)
      ↓
Wavelength Registration (CFL Hg lines: 436, 546, 611 nm fit, R² ≥ 0.999)
      ↓
Physics-Based Absorbance & Matrix Blanking
      ↓
Dual Analytical Modeling:
  ├── Model A: Classical Beer-Lambert (Integrated 630–690 nm band)
  └── Model B: Full-Spectrum Ridge Regression (151 wavelengths, L2 penalty)
      ↓
Objective Model Selection via Leave-One-Out Cross-Validation (LOOCV RMSE)
      ↓
Multi-Tier Quality Control (Saturation, Signal, Alignment, Range, Turbidity)
      ↓
Spectral Anomaly & Out-Of-Distribution Engine (Mahalanobis / Euclidean distance)
      ↓
Uncertainty Estimation (95% Confidence Interval)
      ↓
Diagnostic Verdict (SAFE / CAUTION / ALERT / REJECTED)
      ↓
Explainability Engine (Technical & Simple Language + Hindi Speech Synthesis)
```

### The "AI Knows When It Doesn't Know" Safety Feature
Unlike generic AI wrappers that hallucinate numbers, LISA strictly refuses to predict when a sample's optical signature deviates from the calibrated manifold ($D_{\text{OOD}} > 3.0$ or sensor saturation):
> **"LISA REFUSED TO REPORT A NUMBER"**  
> *Reason: The sample's optical signature is outside the validated calibration space. This measurement requires laboratory verification.*

---

## 4. Hardware Roadmap: The ₹500 Clip-On Lab

```
[White LED Light] ──> [10mm Optical Cuvette] ──> [0.15mm Razor Slit] ──> [1000 lines/mm Grating] ──> [Smartphone Camera]
```

- **Origami Optical Tube:** 300 gsm matte black cardstock lined with anti-reflective tape.
- **Aperture Slit:** Two double-edge carbon steel razor blades mounted parallel with a $0.1–0.2\text{ mm}$ gap.
- **Dispersive Grating:** Transmission film ($1000\text{ lines/mm}$, $33^\circ$ dispersion angle) placed over phone camera lens.
- **Unit Economics:**
  - Prototype Hardware: **₹400 – ₹500** (Mass production target: **₹185 – ₹260**)
  - Reagent Refills (50 tests): **₹50 – ₹100** (**₹1 – ₹2 / test**)

---

## 5. Getting Started & Running Locally

### Prerequisites
- Node.js (v20+ or v22+)
- npm (v10+)

### Installation
```bash
git clone https://github.com/your-org/lisa.git
cd lisa
npm install
```

### Development Server
```bash
npm run dev
```
Open [http://localhost:5173/](http://localhost:5173/) in your browser.

### Production Build
```bash
npm run build
npm run preview
```

### Automated Golden Test Suite
Execute the 7 automated golden scenario validation tests:
```bash
npx tsx scripts/verify-golden-tests.ts
```

---

## 6. Demonstration Modes for Judges

| Mode | Trigger | Purpose | Expected Outcome |
| :--- | :--- | :--- | :--- |
| **Run Demo (2-Min)** | `[RUN DEMO]` button | Automated walkthrough of complete 9-stage pipeline | Scans Vial Y, displays $0.40 \pm 0.04\text{ mg/L}$, opens explainability drawer |
| **Judge Blind Test** | `[BLIND TEST]` button | Audience vial selection (X, Y, Z) with concealed ground truth | Unseals key to reveal lab reference ($0.40\text{ mg/L}$, error $< 2.5\%$) |
| **Adversarial Test** | `[ADVERSARIAL]` button | Tests unvalidated food dye / sensor saturation | Safely triggers **MEASUREMENT REJECTED** state |
| **Phone Calibrate** | `[CALIBRATE PHONE]` button | Normalizes across 4 simulated smartphone CMOS sensors | Generates hash fingerprint (`LISA-XXXX-XXXX`) & reduces cross-phone error |
| **Hardware Schematic**| `[HARDWARE]` button | Shows Origami Foldscope optical ray diagram and BOM | Explains JJM scale economics and field workflow |

---

## 7. Data Provenance & Scientific Honesty

- **Explicit Source Badges:** Every result clearly displays its acquisition source: `SIMULATED`, `UPLOADED`, `LIVE CAMERA`, or `HARDWARE`.
- **Zero Fabricated Numbers:** All displayed metrics ($R^2$, RMSE, LOD, LOQ, $p$-values) are calculated dynamically from underlying data using standard chemometric algorithms.
- **Chemical Distinctions:** Orthophosphate is accurately designated as an environmental pollution tracer, not an official BIS IS 10500 drinking water limit. Heavy metal detection (lead) is strictly scoped as research roadmap only.

---

## 8. Verified Academic References

1. **Feng J, Liu Y, Fu Y, Li X, Ai B.** A consumer-ready smartphone spectrometer for accessible intelligent pocket sensing. *Sensors and Actuators B: Chemical* 462 (2026) 140011. [doi:10.1016/j.snb.2026.140011](https://doi.org/10.1016/j.snb.2026.140011)
2. **Cybulski JS, Clements J, Prakash M.** Foldscope: origami-based paper microscope. *PLoS ONE* 9(6) (2014) e98781. [doi:10.1371/journal.pone.0098781](https://doi.org/10.1371/journal.pone.0098781)
3. **Murphy J, Riley JP.** A modified single solution method for the determination of phosphate in natural waters. *Analytica Chimica Acta* 27 (1962) 31–36.
4. **US Environmental Protection Agency (EPA).** Method 365.3: Phosphorus, all forms (Colorimetric, Ascorbic Acid, Two Reagent). 1978.
5. **Bureau of Indian Standards (BIS).** *IS 10500:2012 Drinking Water — Specification (Second Revision)*.
