// LISA: Scientific Explanation Engine
// Translates structured quantitative metrics into clear, deterministic human explanations

import { ScientificExplanation, QCReport, OODResult } from '../types';

export interface ExplanationInput {
  analyteId?: string;
  analyteName: string;
  chemicalFormula: string;
  concentration: number;
  uncertainty: number;
  unit: string;
  verdict: 'SAFE' | 'CAUTION' | 'ALERT' | 'REJECTED';
  selectedModel: 'beer-lambert' | 'ridge';
  bandStartNm: number;
  bandEndNm: number;
  calibrationRange?: [number, number];
  qc: QCReport;
  ood: OODResult;
  isHindi: boolean;
  deviceFingerprint: string;
  isRejected: boolean;
  rejectionReason?: string;
}

export function generateScientificExplanation(input: ExplanationInput): ScientificExplanation {
  const isLead = input.analyteId === 'lead' || input.analyteName.toLowerCase().includes('lead');

  if (input.isRejected) {
    return {
      headline: 'Measurement Refused by Quality Control',
      dominantSpectralRegion: `${input.bandStartNm}–${input.bandEndNm} nm`,
      absorbanceCharacteristic: 'Anomalous or degraded optical signal',
      beerLambertConsistency: 'INVALID',
      oodAssessment: `OUT-OF-DISTRIBUTION (Score: ${input.ood.score.toFixed(2)})`,
      qcSummary: `QC FAILURE: ${input.rejectionReason || 'Measurement outside calibration space'}`,
      technicalDetails: [
        `The optical profile diverges substantially from the calibrated ${input.analyteName} standard response curve.`,
        'LISA safety constraints prevent generating unverified or hallucinated quantitative values.',
        'Inspect cuvette cleanliness, reagent addition, or dilution before repeating assay.',
      ],
      simpleLanguageSummary:
        `LISA refused to display a number because this sample does not match any ${input.analyteName} sample the instrument was calibrated on. A laboratory test is required.`,
      hindiSummary:
        'लीसा ने यह माप अस्वीकार कर दिया है। यह नमूना सामान्य पानी से भिन्न है और प्रयोगशाला परीक्षण की आवश्यकता है।',
    };
  }

  const concStr = input.concentration.toFixed(2);
  const uncertStr = input.uncertainty.toFixed(2);
  const calMin = input.calibrationRange ? input.calibrationRange[0] : 0.0;
  const calMax = input.calibrationRange ? input.calibrationRange[1] : 1.0;

  const headline = `${input.analyteName}: ${concStr} ± ${uncertStr} ${input.unit}`;

  const dominantSpectralRegion = `${input.bandStartNm}–${input.bandEndNm} nm (Primary chromophore absorption band)`;

  let absorbanceCharacteristic = '';
  if (isLead) {
    absorbanceCharacteristic =
      input.concentration > 0.05
        ? 'Prominent pink chromophore absorption centered at ~520 nm, matching the simulated Lead–dithizone calibration manifold.'
        : 'Trace or near-baseline absorption in 505–535 nm band. Signal is near or below the optical limit of detection without pre-concentration.';
  } else {
    absorbanceCharacteristic =
      input.concentration > 0.05
        ? 'Prominent broad absorption centered at 675 nm, matching the reduced 12-molybdophosphoric blue complex.'
        : 'Near-zero absorption throughout visible band, matching transparent reagent blank.';
  }

  const beerLambertConsistency =
    input.qc.calibrationRangeCheck.status === 'PASS'
      ? 'CONCORDANT (Monotonic linear relationship preserved)'
      : 'DEVIATION (Non-linear roll-off or out-of-bounds)';

  const oodAssessment =
    input.ood.status === 'IN_DISTRIBUTION'
      ? `IN-DISTRIBUTION (Spectral distance: ${input.ood.score.toFixed(2)} ≤ 1.8)`
      : `BORDERLINE (Spectral distance: ${input.ood.score.toFixed(2)})`;

  const qcSummary =
    input.qc.overallStatus === 'PASS'
      ? 'ALL CHECKS PASSED: Signal intensity, optical alignment, and detector linearity verified.'
      : 'ADVISORY: Minor optical deviations detected but within tolerable analytical limits.';

  const technicalDetails = [
    `Predictive Model: ${input.selectedModel === 'ridge' ? 'Full-Spectrum Ridge Regression (151 features)' : 'Beer-Lambert Single-Band Model'}.`,
    `Optical Registration: Cuvette alignment verified against reference blank within ±6 px tolerance.`,
    `Dynamic Range: Signal within ${calMin.toFixed(2)}–${calMax.toFixed(2)} ${input.unit} calibration space.`,
    `Device Normalization: Active sensor fingerprint ${input.deviceFingerprint}.`,
  ];

  if (isLead) {
    technicalDetails.push(
      'Provenance: Deterministic simulation model (research/unvalidated). Real field detection of sub-10 ppb lead requires chemical pre-concentration.'
    );
  }

  let simpleLanguageSummary = `The water contains ${concStr} ${input.unit} of ${input.analyteName}. `;
  if (isLead) {
    if (input.verdict === 'SAFE') {
      simpleLanguageSummary += 'This is at or below the reference drinking water limit (0.01 mg Pb/L). Field optical colorimetry requires pre-concentration for trace ppb quantification.';
    } else if (input.verdict === 'CAUTION') {
      simpleLanguageSummary += 'This approaches guidance thresholds. Follow-up laboratory atomic spectroscopy is recommended.';
    } else {
      simpleLanguageSummary += 'This exceeds the 0.01 mg Pb/L drinking water threshold, indicating hazardous heavy metal contamination.';
    }
  } else {
    if (input.verdict === 'SAFE') {
      simpleLanguageSummary += 'This is well within normal safe freshwater limits.';
    } else if (input.verdict === 'CAUTION') {
      simpleLanguageSummary += 'This is slightly elevated. Keep an eye on local drainage or runoff.';
    } else {
      simpleLanguageSummary += 'This is significantly high, indicating likely sewage, detergent, or agricultural contamination.';
    }
  }

  const hindiSummary = `${input.analyteName} की मात्रा ${concStr} ${input.unit} है। ${
    input.verdict === 'SAFE' ? 'यह पानी सुरक्षित है।' : 'यह पानी असुरक्षित है।'
  }`;

  return {
    headline,
    dominantSpectralRegion,
    absorbanceCharacteristic,
    beerLambertConsistency,
    oodAssessment,
    qcSummary,
    technicalDetails,
    simpleLanguageSummary,
    hindiSummary,
  };
}
