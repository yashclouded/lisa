LISA Software Prototype --- agent.md
0. Mission
You are the implementation agent for LISA (Light-based In-field
Spectral Analyser).

Your job is to build a highly polished, technically credible software
prototype of LISA that demonstrates the intelligence layer of a future
physical sensing instrument.

The final product should feel like a real scientific instrument, not a
generic dashboard and not an AI wrapper.

Core product thesis
LISA is a software-defined computational sensing platform.

The production system will eventually combine:

A low-cost optical hardware module

Chemistry-specific reagent packs

A smartphone camera / optical sensor

Physics-based spectral processing

Machine-learning calibration and inference

Automated measurement-quality checks

Uncertainty estimation

Human-readable scientific explanations

For this hackathon prototype, hardware access is extremely limited.
Therefore:

Build the software/intelligence layer completely and make the
hardware interface pluggable.

The prototype must work with: - synthetic spectra, - uploaded
spectra/data, - generated camera-like optical measurements, - and, if
available, a real camera/image input.

Do not pretend simulated measurements are experimental measurements.

The prototype must visibly distinguish: - SIMULATED - UPLOADED -
CAMERA - HARDWARE

and must never present simulated numbers as experimentally validated
results.

1. Primary objective
Build a browser-based application that can demonstrate the following
complete pipeline:

Sample / optical input
        ↓
Acquisition
        ↓
Computer-vision / ROI processing
        ↓
Spectral representation
        ↓
Blank correction
        ↓
Wavelength mapping
        ↓
Physics-based absorbance calculation
        ↓
Calibration
        ↓
ML inference
        ↓
Model comparison / selection
        ↓
Quality control
        ↓
Uncertainty estimation
        ↓
Concentration estimate
        ↓
Scientific explanation
        ↓
SAFE / CAUTION / ALERT
        ↓
History / export / share
The most important requirement is that every stage is visible and
understandable.

A judge should be able to look at the UI and understand:

"Raw optical data went in. LISA extracted a spectrum, applied physics,
used learned calibration, checked whether the result is trustworthy,
and produced a concentration with uncertainty."

2. Non-negotiable product principles
2.1 Scientific honesty
Never fabricate experimental validation.

If a result comes from: - synthetic data, - a mathematical simulator, -
a public dataset, - manually entered values, - or a hypothetical
hardware response,

label it accordingly.

Use explicit badges:

SIMULATED

PUBLIC DATA

UPLOADED

LIVE CAMERA

HARDWARE

Never display a simulated result with a UI that implies it came from a
physical LISA device.

Never claim that the prototype has detected a contaminant unless the
underlying input and calibration actually support that claim.

2.2 Chemistry is not AI
The product must communicate this correctly.

Chemistry produces the analyte-specific optical signature.

The software: - measures it, - reconstructs it, - calibrates it, -
interprets it, - checks quality, - estimates uncertainty, - and improves
robustness.

Do NOT use marketing language such as:

"AI detects any chemical from a photo."

Use language such as:

"Physics-informed machine learning interprets the optical signature
produced by a chemistry-specific assay."

2.3 One analyte is enough
The main working demo should focus on phosphate.

Iron may exist as a secondary/staged analyte if the architecture
supports it, but do not sacrifice phosphate quality to add multiple
tests.

The source plan explicitly prioritizes phosphate and treats iron as a
stretch target.

The prototype should therefore have an extensible ANALYTES
configuration, but phosphate must be the polished path.

2.4 The application is an instrument
Do not design it like: - a SaaS admin panel, - a generic AI chatbot, - a
crypto dashboard, - a social app, - or a landing page.

It should look like a modern scientific instrument.

Visual language: - dark laboratory/instrument aesthetic OR restrained
white scientific interface - high information density where useful -
large live measurements - clear graphs - calibration diagnostics -
uncertainty - quality-control indicators - technical metadata - subtle
animation - no gratuitous gradients - no excessive cards - no fake 3D
science graphics

The interface should feel closer to: - scientific instrumentation
software, - modern medical diagnostics, - aerospace telemetry, -
computational imaging software.

3. The conceptual architecture
Implement the software as independent layers.

┌──────────────────────────────────────────────────────────┐
│                       LISA UI                            │
├──────────────────────────────────────────────────────────┤
│ Acquisition │ Calibration │ Measure │ Result │ History  │
├──────────────────────────────────────────────────────────┤
│                 Application Controller                   │
├──────────────────────────────────────────────────────────┤
│ QC Engine │ Inference Engine │ Explanation Engine        │
├──────────────────────────────────────────────────────────┤
│ ML Calibration │ Beer-Lambert │ Uncertainty             │
├──────────────────────────────────────────────────────────┤
│ Spectrum Processing │ ROI │ Alignment │ Baseline        │
├──────────────────────────────────────────────────────────┤
│ Input Adapters: Camera / Image / CSV / Simulator        │
├──────────────────────────────────────────────────────────┤
│ Future Hardware Adapter                                 │
└──────────────────────────────────────────────────────────┘
Keep the processing engine independent of the UI.

A future physical LISA device must be able to replace the simulator
without rewriting the inference engine.

4. Recommended stack
Use a pragmatic stack that can be completed quickly.

Frontend
Preferred:

React

TypeScript

Vite

Tailwind CSS

Recharts or another lightweight charting library

Web APIs for camera access

If the existing project already uses another working frontend stack,
preserve it rather than rewriting unnecessarily.

Numerical / ML layer
For browser-first implementation:

TypeScript numerical routines for core calculations

lightweight regression implementation in TypeScript

optionally TensorFlow.js only if genuinely useful

no huge neural-network dependency unless necessary

For offline development/training:

Python

NumPy

pandas

scikit-learn

matplotlib

If a trained model is needed in the browser, export the smallest
required representation.

Do not add a massive dependency simply to make the project sound more
AI-heavy.

5. Repository structure
Create a clean structure similar to:

lisa/
├── agent.md
├── README.md
├── package.json
├── public/
│   ├── demo-data/
│   ├── icons/
│   └── sample-images/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── routes.ts
│   │   └── state.ts
│   ├── components/
│   │   ├── AcquisitionPanel.tsx
│   │   ├── SpectrumChart.tsx
│   │   ├── ResultCard.tsx
│   │   ├── ConfidenceBadge.tsx
│   │   ├── QCPanel.tsx
│   │   ├── CalibrationCurve.tsx
│   │   ├── DeviceCalibration.tsx
│   │   ├── PipelineVisualizer.tsx
│   │   └── ScientificExplanation.tsx
│   ├── engine/
│   │   ├── spectrum.ts
│   │   ├── wavelength.ts
│   │   ├── absorbance.ts
│   │   ├── baseline.ts
│   │   ├── alignment.ts
│   │   ├── roi.ts
│   │   ├── calibration.ts
│   │   ├── regression.ts
│   │   ├── uncertainty.ts
│   │   ├── qc.ts
│   │   ├── ood.ts
│   │   └── deviceCalibration.ts
│   ├── analytes/
│   │   ├── phosphate.ts
│   │   └── registry.ts
│   ├── adapters/
│   │   ├── simulator.ts
│   │   ├── csv.ts
│   │   ├── image.ts
│   │   ├── camera.ts
│   │   └── hardware.ts
│   ├── data/
│   │   ├── demoCalibration.ts
│   │   ├── demoSamples.ts
│   │   └── schemas.ts
│   ├── utils/
│   └── styles/
├── scripts/
│   ├── generate-demo-data.py
│   └── train-model.py
└── tests/
Do not blindly follow this exact structure if the existing repository
has a better one. Preserve working code.

6. Main user experience
The application should have these primary sections:

Overview

Acquire

Calibrate

Measure

Result

Explain

Device Calibration

History

Developer / Diagnostics

The normal demo path should require as few clicks as possible.

7. Overview screen
The first screen should immediately communicate what LISA is.

Hero:

LISA

Computational sensing for the physical world.

Subheading:

Transform imperfect optical measurements into calibrated chemical
measurements using physics-informed AI.

Then show a pipeline:

OPTICAL INPUT
      ↓
SPECTRAL INFERENCE
      ↓
PHYSICS
      ↓
AI CALIBRATION
      ↓
UNCERTAINTY
      ↓
MEASUREMENT
Include:

Current analyte
Phosphate

Current input mode
SIMULATED / UPLOADED / LIVE CAMERA

System status
Sensor              READY
Calibration         READY
Model               READY
Quality control     READY
Include a prominent:

START MEASUREMENT

button.

8. Acquisition screen
This screen should make the prototype feel like a real instrument.

Input modes
Provide:

Mode A --- Simulator
For guaranteed demo reliability.

Controls: - analyte - concentration - noise level - illumination drift -
sensor distortion - wavelength shift - baseline offset - saturation -
turbidity/interference - device profile

The simulator should produce physically plausible spectra rather than
arbitrary random curves.

Every result must display:

SIMULATED

Mode B --- Upload spectrum
Accept: - CSV - JSON

CSV format:

wavelength_nm,intensity
400,0.921
402,0.917
404,0.914
...
Also support absorbance if explicitly declared.

Mode C --- Upload image
Accept a camera image.

Pipeline:

image
↓
ROI detection
↓
spectral extraction
↓
normalization
↓
spectrum
Show the detected ROI visually.

Mode D --- Live camera
Use getUserMedia.

This is optional but highly desirable.

If unavailable: - show a clear fallback - never break the application

Mode E --- Hardware
Create an adapter interface now:

interface HardwareAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  capture(): Promise<RawMeasurement>;
  getStatus(): HardwareStatus;
}
For now implement:

SimulatedHardwareAdapter

Future physical LISA hardware can implement the same interface.

9. Physics-based simulator
This is critical.

Do not make synthetic data look like arbitrary ML toy data.

Generate spectra using a physically meaningful model.

For an analyte:

A(λ) = ε(λ) * l * c
where: - A = absorbance - ε(λ) = wavelength-dependent extinction
profile - l = path length - c = concentration

For phosphate, create a plausible broad absorption profile in the
relevant visible region.

Then:

I_sample(λ) = I_blank(λ) * 10^(-A(λ))
Add configurable real-world effects:

Gaussian sensor noise

multiplicative illumination drift

baseline drift

wavelength shift

camera response nonlinearity

saturation

clipping

turbidity

colour background

random frame noise

This allows the demo to show why calibration and QC matter.

Do not imply the simulator itself is laboratory validation.

10. Spectrum processing engine
Implement a robust pipeline.

10.1 Input normalization
Normalize numeric input and validate: - finite values - monotonically
increasing wavelength - duplicate wavelengths - missing values -
unreasonable ranges

Return structured errors rather than crashing.

10.2 ROI detection
For image input:

convert to a suitable representation

detect the spectrum band

estimate the spectrum axis

find the region containing the spectral signal

reject images with insufficient signal

Show the ROI to the user.

10.3 Frame averaging
For multiple frames:

frame 1
frame 2
...
frame N
↓
column-wise robust mean
The source plan uses 15--30 frames as a normal acquisition range.

Implement: - mean - median - optional trimmed mean

Default to mean/robust mean depending on noise.

10.4 Alignment
Implement cross-correlation between blank and sample spectra.

Allow small shifts.

Return:

{
  shiftPx,
  correlation,
  aligned,
  warning
}
If shift exceeds the configured tolerance, QC should fail or warn.

The source plan specifically calls for cross-correlation alignment to
correct small shifts.

10.5 Baseline correction
Implement a conservative baseline correction.

Possible approaches: - low-order polynomial - rolling minimum -
asymmetric least squares if needed

Do not overprocess the signal.

Always allow the user to inspect: - raw spectrum - corrected spectrum

11. Wavelength calibration
Support:

λ = a * pixel + b
Minimum implementation: - two-point calibration

Preferred: - multi-point least squares calibration

Default reference lines: - 436 nm - 546 nm - 611 nm

These are the CFL reference lines specified in the source plan.

Display:

Wavelength calibration

R² = 0.9997

Residual RMS = 0.8 nm
Target for the demo: - R² ≥ 0.999 where the synthetic/reference
calibration supports it

Do not fabricate a high R² for arbitrary uploaded data.

12. Blank correction
Implement:

A(λ) = -log10(I_sample(λ) / I_blank(λ))
Support two blank types:

Instrument blank
Pure/reference solution.

Sample blank
Same water matrix without the analyte-producing reagent.

The latter is important for coloured/turbid samples because it can
remove background colour.

Display the difference clearly.

13. Calibration engine
Create a calibration dataset containing known standards.

For phosphate, support:

0.00
0.10
0.20
0.40
0.60
0.80
1.00 mg P/L
Allow multiple replicates.

Store:

interface CalibrationPoint {
  concentration: number;
  spectrum: number[];
  wavelength: number[];
  replicate: number;
  deviceId: string;
  timestamp: string;
  sourceMode: SourceMode;
}
14. Beer-Lambert model
Implement a single-band model.

For the selected phosphate band:

A_band → concentration
Fit:

A = kC + b
Return:

{
  slope,
  intercept,
  r2,
  rmse,
  residuals
}
Display the calibration graph:

Absorbance
│
│              ●
│          ●
│       ●
│    ●
│ ●
└──────────────────── Concentration
Show: - R² - RMSE - number of standards - number of replicates

15. ML model
The prototype must include a real ML component.

Implement a full-spectrum ridge regression model.

Input:

A(400)
A(402)
A(404)
...
A(700)
Output:

concentration
Use regularization.

Standardize features where appropriate.

Implement leave-one-out or K-fold cross-validation depending on dataset
size.

Return: - R² - RMSE - MAE - predictions - residuals

16. Model comparison
This is a key demo feature.

Display:

MODEL COMPARISON

Beer-Lambert
R²       0.98
RMSE     0.041

Full-spectrum Ridge
R²       0.99
RMSE     0.028

Selected model:
FULL-SPECTRUM RIDGE
The selection must be based on actual cross-validation performance.

Never hard-code the "AI wins."

If Beer-Lambert performs better, select Beer-Lambert and say so.

This makes the product scientifically credible.

17. Uncertainty engine
Every prediction must have uncertainty.

At minimum implement: - cross-validation RMSE - prediction interval
approximation - calibration residual uncertainty

Output:

interface Prediction {
  concentration: number;
  uncertainty: number;
  lower: number;
  upper: number;
  confidenceScore: number;
}
Example:

0.42 mg/L

± 0.05 mg/L

95% interval:
0.37 – 0.47 mg/L
Do not call this a clinical or regulatory confidence interval unless the
statistical method actually supports that claim.

Label it accurately, e.g.:

Estimated prediction uncertainty

18. Quality-control engine
This should be one of the most visible technical components.

Run QC before accepting a measurement.

QC checks
Saturation
Detect pixels/intensity values near sensor maximum.

Output:

PASS / WARNING / FAIL

Low signal
Detect blank/sample signals that are too dark.

Alignment
Compare sample spectrum with blank.

Reject excessive spectral shift.

Calibration range
If prediction is outside the calibrated range:

OUTSIDE CALIBRATION RANGE

Do not trust direct prediction.

Recommended:
Dilute sample and remeasure.
Spectral anomaly
Check whether the spectrum resembles the calibration distribution.

Out-of-distribution score
Implement a simple method: - standardized distance - Mahalanobis
distance if covariance is stable - nearest-neighbour distance

Return:

In-distribution
Borderline
Out-of-distribution
This is extremely important for the demo.

Interference detection
Check whether absorbance outside the expected analyte region is
unusually high.

Example:

Analyte signature       PASS
Background interference WARNING
19. The "AI knows when it doesn't know" feature
This is a flagship feature.

Create a dedicated result state:

MEASUREMENT REJECTED
instead of forcing a number.

Trigger rejection when: - OOD score too high - severe saturation -
insufficient signal - calibration range exceeded - severe spectral
misalignment - invalid wavelength mapping - missing blank - impossible
spectrum

Show:

LISA REFUSED TO REPORT A NUMBER

Reason:
The sample's optical signature is outside
the validated calibration space.

This measurement requires laboratory verification.
This should be a scripted part of the demo.

20. Device calibration engine
Create a DeviceProfile.

interface DeviceProfile {
  id: string;
  name: string;
  cameraResponse?: number[];
  wavelengthOffset?: number;
  intensityScale?: number;
  colorMatrix?: number[][];
  noiseProfile?: number[];
  calibrationVersion: string;
}
Support simulated devices.

Example:

DEVICE A
reference smartphone

DEVICE B
warm camera response

DEVICE C
cool camera response

DEVICE D
low-light budget sensor
Generate device-specific distortions.

Then demonstrate:

WITHOUT DEVICE CALIBRATION
Device A: high agreement
Device B: degraded
Device C: degraded
Device D: poor

WITH LISA CALIBRATION
Device A: improved
Device B: improved
Device C: improved
Device D: improved
All displayed values must come from actual simulation/training runs, not
hard-coded fake benchmarks.

21. Device fingerprinting
Create a visually impressive device-calibration flow.

CALIBRATING DEVICE

[1] Reference white       ✓
[2] Blank sample         ✓
[3] Optical response     ✓
[4] Noise characterization ✓
[5] Model alignment      ✓

Device fingerprint

LISA-7F42-A91C
This creates the feeling that LISA is building a personalized scientific
sensor profile for each phone.

22. Explainability engine
After every prediction, show:

Why did LISA believe this?
Display: - dominant wavelength region - calibration similarity - model
type - uncertainty - QC - OOD status

Example:

WHY THIS RESULT?

1. Strongest predictive region
   630–690 nm

2. Beer-Lambert consistency
   PASS

3. Calibration similarity
   HIGH

4. Device calibration
   ACTIVE

5. Out-of-distribution score
   LOW

6. Prediction uncertainty
   ±0.05 mg/L
If using ridge regression, show coefficient importance carefully.

Do not claim causal interpretation from model coefficients.

Use wording:

Model sensitivity / contribution

not:

This wavelength proves the chemical is present.

23. Pipeline visualizer
Create an animated pipeline:

RAW INPUT
   ↓
ROI
   ↓
SPECTRUM
   ↓
BLANK CORRECTION
   ↓
PHYSICS
   ↓
AI CALIBRATION
   ↓
QC
   ↓
UNCERTAINTY
   ↓
RESULT
Each block should light up as the system processes.

Clicking a block should open technical details.

This is one of the most important presentation features.

24. The main measurement screen
Layout:

┌─────────────────────────────────────────────────────┐
│ LISA     PHOSPHATE          SIMULATED / CAMERA      │
├──────────────────────┬──────────────────────────────┤
│                      │                              │
│   INPUT / CAMERA     │       LIVE SPECTRUM          │
│                      │                              │
│                      │      graph                   │
│                      │                              │
├──────────────────────┼──────────────────────────────┤
│ QC                   │ MODEL                        │
│ ✓ Signal             │ Ridge regression             │
│ ✓ Alignment          │ R² ...                       │
│ ✓ Calibration        │ RMSE ...                     │
│ ✓ OOD                │                              │
├──────────────────────┴──────────────────────────────┤
│                  RESULT                             │
│                                                     │
│                 0.42 mg/L                            │
│                 ±0.05 mg/L                           │
│                                                     │
│              CONFIDENCE: HIGH                       │
└─────────────────────────────────────────────────────┘
25. Result states
Create four states.

SAFE
0.03 mg/L
Below alert threshold
CAUTION
0.07 mg/L
Elevated
ALERT
0.15 mg/L
Above configured alert threshold
UNKNOWN / REJECTED
No reliable measurement
Do not imply regulatory status unless the threshold is actually sourced
and configured appropriately.

For phosphate specifically, distinguish an indicator/guidance
threshold from a drinking-water regulatory limit. Do not label
phosphate as a BIS drinking-water parameter.

26. History
Store measurements locally.

Each record:

interface MeasurementRecord {
  id: string;
  timestamp: string;
  analyte: string;
  concentration?: number;
  uncertainty?: number;
  lower?: number;
  upper?: number;
  verdict?: string;
  qcStatus: string;
  oodStatus: string;
  model: string;
  sourceMode: SourceMode;
  deviceId: string;
  calibrationId: string;
  spectrum?: number[];
  wavelengths?: number[];
  notes?: string;
}
History features: - search - filter - inspect - export CSV - export
JSON - delete - compare measurements

27. Measurement comparison
Allow the user to select multiple measurements.

Show:

Measurement A
Measurement B
Measurement C
with: - concentration - uncertainty - spectrum overlay - QC - device
profile

This can become a powerful demo for repeatability.

28. Calibration dashboard
Show:

Calibration quality
R²
RMSE
LOD
LOQ
Repeatability
Calibration curve
Residual plot
Cross-validation
Model comparison
Device profile
Calibration version
The source plan explicitly expects R², LOD/LOQ and error metrics to be
part of the calibration/validation workflow.

Do not invent laboratory values.

29. LOD and LOQ
Implement the standard calculation used in the source plan:

LOD = 3.3 * sy/x / k
LOQ = 10 * sy/x / k
where appropriate for the calibration model.

Explain: - k = calibration slope - sy/x = residual standard
deviation

If the data are insufficient to calculate a meaningful LOD/LOQ, display:

Insufficient calibration data

rather than inventing a number.

30. Demo dataset
Create a deterministic demo dataset.

It should contain:

Clean standards
0.00
0.10
0.20
0.40
0.60
0.80
1.00 mg/L
with replicates.

Unknowns
At least:

Unknown A
Unknown B
Unknown C
Adversarial samples
At least:

noisy sample

shifted spectrum

saturated sample

out-of-range sample

coloured/interfering sample

completely out-of-distribution sample

The purpose is to demonstrate that LISA can both measure and refuse bad
measurements.

31. Deterministic randomness
The simulator must use seeded randomness.

Use a seed such as:

LISA-DEMO-2026

This guarantees that: - judges see consistent results - screenshots
remain reproducible - tests remain stable - the demo does not randomly
break

Allow changing the seed in developer mode.

32. Demo mode
Create a dedicated:

DEMO MODE

button.

Demo mode should run the full pipeline automatically.

Sequence:

1. Load unknown sample
2. Acquire optical signal
3. Detect ROI
4. Generate spectrum
5. Correct blank
6. Run physics model
7. Run ML model
8. Compare models
9. Run QC
10. Estimate uncertainty
11. Generate result
12. Generate explanation
Use a subtle 2--4 second animation so the audience can follow what is
happening.

Do not artificially delay the actual calculation if unnecessary; use
staged animation only for presentation.

33. Blind-test mode
Create:

BLIND TEST

The operator selects an unknown sample.

The true concentration is hidden from the measurement screen.

LISA generates its prediction.

Only after the operator clicks:

REVEAL GROUND TRUTH

should the actual value appear.

Then display:

LISA
0.41 mg/L

GROUND TRUTH
0.40 mg/L

ERROR
2.5%
Only use actual values from the demo dataset.

Label the experiment:

SIMULATED BLIND TEST

unless the sample was physically measured.

34. Adversarial demo
This is potentially the best feature.

Give LISA an intentionally bad sample.

For example:

OUT-OF-DISTRIBUTION SAMPLE
LISA should refuse.

Then say:

"The interesting part isn't that our model can predict. It's that the
system knows when the prediction isn't trustworthy."

This demonstrates safety/robustness rather than AI hype.

35. Public dataset support
Architect the application so external spectral datasets can be imported
later.

Do not silently mix: - synthetic data - public data - experimental data

Every dataset should carry metadata:

interface DatasetMetadata {
  id: string;
  name: string;
  sourceType: "synthetic" | "public" | "experimental" | "uploaded";
  sourceName?: string;
  citation?: string;
  analyte?: string;
  units?: string;
}
If a public dataset is used, show the source in the UI.

36. Future hardware interface
The software should not care whether the input comes from:

Simulator
CSV
Image
Camera
Physical LISA
All should normalize to:

interface RawMeasurement {
  intensity: number[];
  wavelengths?: number[];
  image?: ImageData;
  frames?: number[][];
  timestamp: string;
  sourceMode: SourceMode;
  deviceId?: string;
}
Then:

RawMeasurement
      ↓
ProcessingEngine
This architecture is essential.

When the physical LISA hardware is built later, the team should only
need to implement the hardware adapter.

37. Hardware roadmap screen
Include a clearly labeled:

PHYSICAL LISA --- NEXT

Show the planned hardware diagram:

LED
 ↓
CUVETTE
 ↓
SLIT
 ↓
DIFFRACTION GRATING
 ↓
PHONE CAMERA
 ↓
LISA ENGINE
Mark it:

ROADMAP / HARDWARE PROTOTYPE

Do not imply that the current software has physically validated this
path.

38. Future chemistry-pack architecture
Create an analyte registry.

Example:

interface AnalyteDefinition {
  id: string;
  name: string;
  unit: string;
  wavelengthRange: [number, number];
  calibrationRange: [number, number];
  alertThreshold?: number;
  cautionThreshold?: number;
  modelType: string;
  reagentDescription: string;
  status: "live" | "development" | "roadmap";
}
Phosphate:

status: live

Iron:

status: development

Fluoride:

status: roadmap

Nitrate:

status: roadmap

Lead:

status: research

This allows the same software platform to support future chemistry
packs.

39. Do not implement unsafe chemistry
The software may describe reagent chemistry at a high level, but do not
create operational instructions for unsafe handling in the application.

The physical prototype's concentrated reagents are
laboratory-controlled.

The production vision should use:

sealed, pre-dosed reagent packs

rather than requiring a field user to handle concentrated acid.

40. AI architecture
The AI layer should be modular.

Implement:

Feature extraction
      ↓
Preprocessing
      ↓
Model selection
      ↓
Prediction
      ↓
Uncertainty
      ↓
OOD
Model registry:

interface ModelDefinition {
  id: string;
  name: string;
  version: string;
  inputType: string;
  predict(x: number[]): Prediction;
  evaluate(dataset: Dataset): Metrics;
}
Initial models: - Beer-Lambert - Ridge

Future: - PLS - 1D CNN - GAF + 2D CNN - cross-device shared model

Do not build a CNN just to say "CNN."

The prototype should prove that the architecture supports more advanced
models.

41. AI roadmap
Include a technical roadmap page:

V1 --- Current prototype
Beer-Lambert

Ridge regression

computer vision

QC

uncertainty

device calibration

V2
larger real spectral dataset

cross-phone calibration

kinetic measurements

interference classification

V3
deep spectral model

GAF + 2D CNN

shared calibration model

anomaly detection from community data

The source plan identifies GAF + 2D-CNN, cross-phone calibration,
kinetic readings and anomaly maps as later AI directions.

42. Scientific explanation engine
Do not use an LLM as the core measurement engine.

The measurement must be deterministic from: - spectrum - calibration -
model - QC

An LLM, if added, may only translate structured measurement metadata
into human-readable language.

Example structured object:

{
  "analyte": "phosphate",
  "prediction": 0.42,
  "uncertainty": 0.05,
  "model": "ridge",
  "qc": "pass",
  "ood": "low",
  "dominant_region_nm": [630, 690]
}
The explanation layer converts this into:

"The measurement is within the calibrated range. The prediction is
primarily supported by the expected optical response in the 630--690
nm region. Signal quality and device alignment passed quality checks."

Never allow an LLM to invent: - concentrations - laboratory validation -
citations - regulatory status - confidence - experimental results

43. Accessibility / field use
The production concept is intended for non-expert field users.

Include: - simple language mode - Hindi result readout - English result
readout - large result typography - offline-first architecture - share
result - CSV export

The original plan includes Hindi voice, WhatsApp/share, local history
and offline operation.

44. Offline-first requirement
The core measurement pipeline must work without an internet connection.

Internet may be required only for: - optional cloud synchronization -
map - external dataset retrieval - optional AI explanation service

Do not make the core demo depend on: - an API server - OpenAI -
Firebase - Supabase - a cloud ML endpoint

The scientific engine must work locally.

45. Performance requirements
Target:

initial page load < 2 seconds on a modern laptop

spectrum processing < 500 ms for normal data

regression inference < 100 ms

no UI freezing

camera preview smooth enough for demonstration

Use Web Workers if numerical processing blocks the UI.

46. Error handling
Never crash because: - CSV is malformed - image is blurry - camera
permission denied - spectrum has missing values - calibration has too
few points - model cannot fit - uploaded wavelengths are unordered -
sample is outside range

Instead display:

MEASUREMENT CANNOT PROCEED

Reason:
Calibration requires at least 4 valid standards.

Next step:
Add more standards.
47. Developer diagnostics
Create a hidden or clearly separate:

Diagnostics

screen.

Show:

Input mode
Device ID
Calibration ID
Model version
Wavelength fit
R²
Signal max
Signal min
Noise estimate
Alignment shift
OOD score
QC status
Processing time
Allow: - export raw input - export processed spectrum - export
calibration - export measurement JSON - reset demo data

This makes debugging during the hackathon much easier.

48. Data provenance
Every result should be traceable.

A measurement should know:

source
→ raw input
→ preprocessing version
→ calibration version
→ model version
→ prediction
→ QC
→ uncertainty
Example:

Measurement
LISA-M-00291

Source:
SIMULATED

Device:
DEMO-ANDROID-01

Calibration:
PHOSPHATE-CAL-V3

Model:
RIDGE-V1

Processing:
PIPELINE-V4

Result:
0.42 ± 0.05 mg/L
This is a major credibility feature.

49. Version everything
Use explicit versions:

Pipeline v0.1
Calibration v0.1
Model v0.1
Dataset v0.1
When a result is saved, preserve those versions.

50. Testing requirements
Write automated tests for:

Math
Beer-Lambert calculation

blank correction

wavelength interpolation

regression

R²

RMSE

LOD/LOQ

uncertainty

Signal processing
alignment

baseline correction

smoothing

saturation detection

range detection

QC
OOD detection

low signal

shifted spectrum

out-of-range

missing blank

UI
acquisition flow

calibration flow

result flow

rejected measurement flow

51. Golden test cases
Create these exact test scenarios.

Test 1 --- Perfect standard
Expected: - prediction close to true concentration - QC PASS - OOD LOW

Test 2 --- Noisy standard
Expected: - prediction remains reasonable - uncertainty increases

Test 3 --- Shifted spectrum
Expected: - alignment correction - warning if shift too large

Test 4 --- Saturated input
Expected: - measurement rejected

Test 5 --- Out-of-range
Expected: - no trusted concentration - dilution recommendation

Test 6 --- Unknown spectrum
Expected: - OOD warning/rejection

Test 7 --- Different device
Expected: - device calibration reduces simulated device distortion

52. Demo acceptance criteria
The software is not finished until all of these work:

Core
Start application

Select phosphate

Select SIMULATED mode

Run acquisition

See spectrum

See absorbance

See calibration

Run Beer-Lambert

Run Ridge model

Compare models

Select model using cross-validation

Generate prediction

Generate uncertainty

Run QC

Display result

Explain result

Save result

Export JSON/CSV

Advanced
Upload spectrum

Upload image

Live camera if supported

Device calibration

OOD detection

rejected measurement

blind test

adversarial test

pipeline animation

diagnostics

53. The 2-minute hackathon demo
The application should have a deterministic demo sequence.

0:00
Landing screen.

Say:

"This is LISA. The hardware will eventually capture the optical
signal. What you're seeing now is the intelligence layer."

Click:

START MEASUREMENT

0:15
Select:

Phosphate

Input:

SIMULATED OPTICAL SENSOR

Show acquisition.

0:30
Spectrum appears.

Pipeline animates:

RAW
 ↓
ROI
 ↓
SPECTRUM
 ↓
PHYSICS
 ↓
AI
0:50
Model comparison:

Beer-Lambert
R² = ...

Ridge
R² = ...

Selected:
Ridge
Use real computed demo metrics.

1:00
Result:

0.42 mg/L
±0.05 mg/L

Confidence: HIGH
1:10
Open:

WHY?

Show: - spectral region - QC - device calibration - OOD - uncertainty

1:25
Run adversarial sample.

Result:

MEASUREMENT REJECTED

OUT OF DISTRIBUTION
Say:

"This is deliberate. LISA doesn't invent a measurement when the sample
doesn't resemble anything it was calibrated on."

1:40
Open device calibration.

Show:

Phone A
Phone B
Phone C

→ common measurement space
1:50
Open hardware roadmap.

Show:

Cheap optical module
        ↓
phone camera
        ↓
same LISA engine
2:00
Final line:

"We're not building another water-testing app. We're building the
intelligence layer that turns inexpensive optical hardware into
scientific instruments."

54. VC / startup framing
The UI itself should not become a pitch deck.

But the product should make these concepts obvious:

Technology
Physics-informed computational sensing.

Initial wedge
Water-quality testing.

Platform
Reusable chemistry + sensing + inference architecture.

Hardware
Low-cost optical front-end.

Software
Calibration, spectral inference, QC, uncertainty.

Data moat
Every validated measurement contributes to: - device calibration -
spectral libraries - interference profiles - model improvement

Recurring model
Future reagent packs / consumables.

Do not display unsupported market-size numbers inside the software.

55. Future product architecture
The long-term architecture is:

                     LISA PLATFORM
                          │
            ┌─────────────┴─────────────┐
            │                           │
      OPTICAL HARDWARE             SOFTWARE ENGINE
            │                           │
      cheap sensor               signal processing
      chemistry pack             spectral inference
      phone interface             physics
                                  ML
                                  QC
                                  uncertainty
                                  device calibration
                                      │
                         ┌────────────┼────────────┐
                         ↓            ↓            ↓
                       WATER         FOOD         SOIL
56. What NOT to build
Do not waste time on:

authentication

user accounts

payment

complicated backend

social feed

chat

generic AI assistant

huge database

community map unless core system is complete

cloud ML

unnecessary animations

custom design system

complicated mobile app packaging

production hardware controls

The goal is a technically impressive prototype, not a complete SaaS
business.

57. What NOT to fake
Never hard-code: - R² - accuracy - LOD - RMSE - confidence - device
calibration improvement - error vs laboratory instrument

If the demo dataset produces: R² = 0.984

show:

R² = 0.984

Do not change it to:

R² = 0.997

for presentation.

The software can have a curated demo dataset, but all displayed metrics
must be computed from it.

58. Visual polish requirements
Use: - clean typography - strong hierarchy - responsive graphs - smooth
transitions - clear units - scientific notation where appropriate -
tooltips for technical terms - keyboard support - mobile-responsive
layout

Avoid: - emoji-heavy interfaces - fake holograms - excessive neon -
giant marketing slogans inside the instrument - unexplained AI
terminology - decorative graphs with no data meaning

59. Empty states
Every empty state should be useful.

Example:

NO CALIBRATION

LISA needs reference standards before
it can estimate concentration.

[LOAD DEMO CALIBRATION]
[IMPORT CALIBRATION]
60. Loading states
During processing:

PROCESSING OPTICAL SIGNAL

✓ Input validated
✓ ROI detected
✓ Spectrum extracted
✓ Blank corrected
→ Running model
→ Estimating uncertainty
→ Running quality control
This is useful both UX and demo theatre.

61. Accessibility of scientific language
Technical mode:

Out-of-distribution score: 2.84

Simple mode:

This sample looks different from the samples LISA was calibrated on.

Allow a toggle:

TECHNICAL / SIMPLE

62. Security / privacy
The core prototype should: - process data locally - avoid uploading
camera images by default - clearly state when external services are
used - not request unnecessary permissions

Camera permission should only be requested when live camera mode is
selected.

63. README requirements
Create a README explaining:

What LISA is

What the prototype does

What is simulated

What is experimentally validated

Architecture

How to run

How to run tests

How to run demo mode

Data provenance

Scientific limitations

Future hardware interface

64. Source-of-truth scientific concepts
The original LISA plan defines:

phosphate as the primary 24-hour analyte

molybdenum-blue chemistry

Beer-Lambert absorbance

10 mm cuvette

400--700 nm spectral design range

phone-based optical detection

calibration curves

R² / LOD / LOQ / repeatability

full-spectrum ridge regression

computer-vision ROI

cross-correlation drift correction

automatic QC

cross-phone calibration as a future capability

GAF + 2D-CNN as a later model direction

Preserve these concepts unless implementation constraints require a
clearly documented simplification.

65. Critical scientific caveats
The software must communicate these correctly.

Phosphate
Phosphate is being used as an indicator/contamination tracer in the
prototype. Do not represent it as a BIS drinking-water parameter.

Lead
Do not implement or claim validated lead detection.

Real samples
Coloured/turbid samples can introduce interference.

Hardware
Real camera measurements will be noisier than synthetic data.

Accuracy
Only measured experimental validation can establish real-world accuracy.

AI
AI does not identify arbitrary chemicals without chemistry-specific
calibration.

66. Final definition of done
The project is complete when a technically sophisticated judge can sit
down at the laptop and do this:

START
 ↓
Choose phosphate
 ↓
Choose input
 ↓
Acquire signal
 ↓
See raw data
 ↓
See spectrum
 ↓
See blank correction
 ↓
See physics model
 ↓
See AI model
 ↓
See model comparison
 ↓
See QC
 ↓
See uncertainty
 ↓
See final concentration
 ↓
Click "Why?"
 ↓
Understand the scientific reasoning
 ↓
Run a bad sample
 ↓
See LISA refuse an unreliable prediction
 ↓
Calibrate another simulated device
 ↓
See the result move toward the canonical measurement space
 ↓
Open hardware roadmap
 ↓
Understand how the same software will control the eventual
physical LISA sensor
If any of these steps are fake, hard-coded, or merely decorative, fix
it.

67. Priority order
If time becomes limited, work in this exact order.

P0 --- absolutely required
Working application

Phosphate simulator

Spectrum visualization

Beer-Lambert model

Ridge model

Model comparison

Prediction

Uncertainty

QC

Result screen

Deterministic demo mode

P1 --- highly valuable
OOD detection

Rejected measurement

Device calibration simulation

Pipeline visualizer

Calibration dashboard

History

CSV/JSON export

P2 --- only after P0/P1
Image upload

Live camera

Blind-test mode

adversarial demo

explanation layer

Hindi voice

hardware adapter

P3 --- roadmap only
Cloud sync

community map

GAF + CNN

kinetic analysis

multiple chemistry packs

real hardware integration

68. Agent behavior
As the implementation agent:

Do
inspect the existing repository before changing it

preserve useful existing code

build incrementally

run tests after major changes

verify mathematical outputs

use deterministic demo data

make the main demo path extremely reliable

document assumptions

expose diagnostics

prioritize P0 over P2 features

Do not
invent scientific validation

fabricate metrics

hide uncertainty

claim experimental results from simulation

add dependencies without need

rewrite the project unnecessarily

build backend infrastructure before the scientific engine works

optimize for code volume

confuse visual complexity with technical sophistication

69. Final product philosophy
The prototype should communicate one idea:

LISA is not an app that guesses what is in water.

It is:

a computational scientific instrument.

The eventual physical system captures imperfect optical information.

The software: - reconstructs the signal, - applies physical laws, -
learns calibration, - adapts across devices, - quantifies uncertainty, -
detects unreliable measurements, - and turns the result into something a
non-expert can understand.

The prototype therefore needs to demonstrate the intelligence of the
future instrument, even before the complete physical instrument
exists.

Build that system first.

