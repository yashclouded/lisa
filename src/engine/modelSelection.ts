// LISA: Cross-Validation Model Selection
// Objectively selects between Beer-Lambert and Full-Spectrum Ridge based on LOOCV RMSE

import { ModelMetrics } from '../types';

export interface ModelComparisonResult {
  selectedModel: 'beer-lambert' | 'ridge';
  selectedMetrics: ModelMetrics;
  rationale: string;
  beerLambertMetrics: ModelMetrics;
  ridgeMetrics: ModelMetrics;
  percentImprovement: number;
}

export function selectOptimalModel(
  beerMetrics: ModelMetrics,
  ridgeMetrics: ModelMetrics
): ModelComparisonResult {
  const beerCv = beerMetrics.loocvRmse;
  const ridgeCv = ridgeMetrics.groupedCvRmse ?? ridgeMetrics.loocvRmse;

  // If both models have valid cross-validation errors, compare objectively
  if (ridgeCv !== null && beerCv !== null) {
    const ridgeWins = ridgeCv < beerCv;
    const selectedModel = ridgeWins ? 'ridge' : 'beer-lambert';
    const selectedMetrics = ridgeWins ? ridgeMetrics : beerMetrics;

    const diff = Math.abs(beerCv - ridgeCv);
    const baseline = Math.max(1e-4, beerCv);
    const percentImprovement = (diff / baseline) * 100;

    let rationale = '';
    if (ridgeWins) {
      rationale = `Full-Spectrum Ridge selected: Achieved lower cross-validation RMSE (${ridgeCv.toFixed(4)} vs ${beerCv.toFixed(4)} mg/L, +${percentImprovement.toFixed(1)}% precision gain) by regularizing across all 151 spectral features.`;
    } else {
      rationale = `Beer-Lambert selected: Classical single-band absorption demonstrated equal or superior cross-validation generalization (${beerCv.toFixed(4)} vs ${ridgeCv.toFixed(4)} mg/L), favoring parsimonious physical modeling.`;
    }

    return {
      selectedModel,
      selectedMetrics,
      rationale,
      beerLambertMetrics: beerMetrics,
      ridgeMetrics,
      percentImprovement: parseFloat(percentImprovement.toFixed(1)),
    };
  }

  // Handle uncalibrated/null states
  if (ridgeCv !== null) {
    return {
      selectedModel: 'ridge',
      selectedMetrics: ridgeMetrics,
      rationale: 'Full-Spectrum Ridge selected (Beer-Lambert is uncalibrated).',
      beerLambertMetrics: beerMetrics,
      ridgeMetrics,
      percentImprovement: 0,
    };
  }

  return {
    selectedModel: 'beer-lambert',
    selectedMetrics: beerMetrics,
    rationale: 'Beer-Lambert selected by default.',
    beerLambertMetrics: beerMetrics,
    ridgeMetrics,
    percentImprovement: 0,
  };
}
