// LISA: Predictive model summary
// The headline numbers stay visible; the head-to-head comparison that justifies
// the model choice sits behind one disclosure.

import React from 'react';
import { ModelMetrics } from '../types';
import { StatusPill } from './ui/Status';
import { Disclosure } from './ui/Disclosure';

interface ModelComparisonProps {
  beerMetrics: ModelMetrics;
  ridgeMetrics: ModelMetrics;
  selectedModel: 'beer-lambert' | 'ridge' | 'none';
}

const MODEL_NAME: Record<'beer-lambert' | 'ridge' | 'none', string> = {
  'beer-lambert': 'Beer-Lambert',
  ridge: 'Ridge regression',
  none: 'Uncalibrated',
};

const MODEL_DETAIL: Record<'beer-lambert' | 'ridge' | 'none', string> = {
  'beer-lambert': 'single-band 630–690 nm',
  ridge: '151 spectral bands',
  none: 'No calibrated model deployed',
};

export const ModelComparison: React.FC<ModelComparisonProps> = ({
  beerMetrics,
  ridgeMetrics,
  selectedModel,
}) => {
  const active = selectedModel === 'ridge' ? ridgeMetrics : beerMetrics;

  return (
    <div className="card">
      <div className="card__head">
        <span className="card__title">Predictive model</span>
        <StatusPill tone="accent">{MODEL_NAME[selectedModel]}</StatusPill>
      </div>

      <div className="card__body" style={{ gap: 0, paddingTop: 12 }}>
        <div className="metrics">
          <div className="metric">
            <span className="metric__label">Validation RMSE (Grouped CV)</span>
            <span className="metric__value">
              {active.groupedCvRmse !== undefined && active.groupedCvRmse !== null
                ? active.groupedCvRmse.toFixed(4)
                : active.loocvRmse !== null
                  ? active.loocvRmse.toFixed(4)
                  : '—'}{' '}
              mg/L
            </span>
          </div>
          <div className="metric">
            <span className="metric__label">Calibration fit (R²)</span>
            <span className="metric__value">{active.r2 !== null ? active.r2.toFixed(4) : '—'}</span>
          </div>
        </div>

        <Disclosure label="Compare models">
          <div className="table-scroll">
            <table className="table">
              <caption className="sr-only">
                Cross-validated performance of both candidate models
              </caption>
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  <th scope="col">Beer-Lambert</th>
                  <th scope="col">Ridge</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row" style={{ fontWeight: 400, color: 'var(--ink-2)', padding: '10px 12px 10px 0', borderBottom: '1px solid var(--line)' }}>
                    Linearity (R²)
                  </th>
                  <td
                    className={selectedModel === 'beer-lambert' ? 'table__selected' : ''}
                  >
                    {beerMetrics.r2 !== null ? beerMetrics.r2.toFixed(4) : '—'}
                  </td>
                  <td className={selectedModel === 'ridge' ? 'table__selected' : ''}>
                    {ridgeMetrics.r2 !== null ? ridgeMetrics.r2.toFixed(4) : '—'}
                  </td>
                </tr>
                <tr>
                  <th scope="row" style={{ fontWeight: 400, color: 'var(--ink-2)', padding: '10px 12px 10px 0', borderBottom: '1px solid var(--line)' }}>
                    Absorbance Fit (AU)
                  </th>
                  <td
                    className={selectedModel === 'beer-lambert' ? 'table__selected' : ''}
                  >
                    {beerMetrics.rmse !== null ? `${beerMetrics.rmse.toFixed(4)} AU` : '—'}
                  </td>
                  <td className={selectedModel === 'ridge' ? 'table__selected' : ''}>
                    <span style={{ color: 'var(--ink-3)' }}>— (multivariate)</span>
                  </td>
                </tr>
                <tr>
                  <th scope="row" style={{ fontWeight: 400, color: 'var(--ink-2)', padding: '10px 12px 10px 0', borderBottom: '1px solid var(--line)' }}>
                    Calibration RMSE (mg/L)
                  </th>
                  <td
                    className={selectedModel === 'beer-lambert' ? 'table__selected' : ''}
                  >
                    {beerMetrics.concentrationRmse !== null && beerMetrics.concentrationRmse !== undefined
                      ? `${beerMetrics.concentrationRmse.toFixed(4)} mg/L`
                      : '—'}
                  </td>
                  <td className={selectedModel === 'ridge' ? 'table__selected' : ''}>
                    {ridgeMetrics.rmse !== null ? `${ridgeMetrics.rmse.toFixed(4)} mg/L` : '—'}
                  </td>
                </tr>
                <tr>
                  <th scope="row" style={{ fontWeight: 400, color: 'var(--ink-2)', padding: '10px 12px 10px 0', borderBottom: '1px solid var(--line)' }}>
                    Grouped CV RMSE (mg/L)
                  </th>
                  <td
                    className={selectedModel === 'beer-lambert' ? 'table__selected' : ''}
                  >
                    {beerMetrics.loocvRmse !== null ? `${beerMetrics.loocvRmse.toFixed(4)} mg/L` : '—'}
                  </td>
                  <td className={selectedModel === 'ridge' ? 'table__selected' : ''}>
                    {ridgeMetrics.groupedCvRmse !== null && ridgeMetrics.groupedCvRmse !== undefined
                      ? `${ridgeMetrics.groupedCvRmse.toFixed(4)} mg/L`
                      : ridgeMetrics.loocvRmse !== null
                        ? `${ridgeMetrics.loocvRmse.toFixed(4)} mg/L`
                        : '—'}
                  </td>
                </tr>
                <tr>
                  <th scope="row" style={{ fontWeight: 400, color: 'var(--ink-2)', padding: '10px 12px 10px 0', borderBottom: '1px solid var(--line)' }}>
                    Deployed
                  </th>
                  <td style={{ color: selectedModel === 'beer-lambert' ? 'var(--pass)' : 'var(--ink-3)' }}>
                    {selectedModel === 'beer-lambert' ? 'Selected' : '—'}
                  </td>
                  <td style={{ color: selectedModel === 'ridge' ? 'var(--pass)' : 'var(--ink-3)' }}>
                    {selectedModel === 'ridge' ? 'Selected' : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="field__hint" style={{ marginTop: 14 }}>
            {selectedModel === 'ridge'
              ? `Full-spectrum Ridge regression was deployed because it achieved the lower leave-one-out cross-validation error. Multivariate regression over all 151 wavelength bands regularises against localised baseline distortion that a single-band model cannot separate from the analyte signal (${MODEL_DETAIL.ridge}).`
              : `The single-band Beer-Lambert model was deployed because it matched or beat full-spectrum regression under leave-one-out cross-validation. With fewer free parameters it generalises better on this calibration set (${MODEL_DETAIL['beer-lambert']}).`}
          </p>
        </Disclosure>
      </div>
    </div>
  );
};
