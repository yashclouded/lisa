// LISA: Developer diagnostics
// Instrument telemetry and the split-sample laboratory benchmark. Intended for
// whoever is checking the numbers, so it leads with figures and stays quiet
// about everything else.

import React, { useState } from 'react';
import { Key, RotateCcw } from 'lucide-react';
import { LAB_BENCHMARK_SERIES } from '../data/labBenchmark';
import { defaultPRNG } from '../engine/prng';
import { getOrchestratorCalibration } from '../engine/orchestrator';
import { Modal } from './ui/Modal';
import { StatusPill } from './ui/Status';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lastExecutionMs: number;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  isOpen,
  onClose,
  lastExecutionMs,
}) => {
  const [prngSeed, setPrngSeed] = useState(defaultPRNG.getSeed());
  const [seedNotice, setSeedNotice] = useState<string | null>(null);
  const cal = getOrchestratorCalibration();

  const handleUpdateSeed = () => {
    defaultPRNG.setSeed(prngSeed);
    setSeedNotice(`Seed locked to “${prngSeed}”. Synthetic spectra are now deterministic.`);
  };

  const telemetry = [
    {
      label: 'Pipeline latency',
      value: lastExecutionMs > 0 ? `${lastExecutionMs} ms` : '—',
    },
    { label: 'Calibration ID', value: cal.calibrationId },
    {
      label: 'Beer-Lambert fit',
      value: cal.beerLambertFit.r2 !== null ? cal.beerLambertFit.r2.toFixed(4) : '—',
      hint: 'R²',
    },
    {
      label: 'Ridge Grouped CV RMSE',
      value: `${cal.ridgeModel.groupedCvRmse.toFixed(4)} mg/L`,
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Diagnostics"
      subtitle="Instrument telemetry and simulated split-sample concordance against benchtop UV-Vis reference standards."
      size="wide"
    >
      <div className="metrics">
        {telemetry.map((item) => (
          <div className="metric" key={item.label}>
            <span className="metric__label">{item.label}</span>
            <span className="metric__value mono">
              {item.value}
              {item.hint && (
                <span style={{ color: 'var(--ink-3)', marginLeft: 4, fontSize: 11.5 }}>
                  {item.hint}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="field">
        <div className="field__label">
          <span
            style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--ink-2)' }}
          >
            <Key size={14} aria-hidden="true" />
            Deterministic seeded randomness
          </span>
          <span className="field__value">Reproducible demo</span>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          Pins the pseudo-random generator so every synthetic spectrum is byte-identical across
          runs. Change the seed to explore a different noise draw.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="input mono"
            value={prngSeed}
            onChange={(e) => {
              setPrngSeed(e.target.value);
              setSeedNotice(null);
            }}
            aria-label="PRNG seed"
            style={{ flex: '1 1 180px', minWidth: 0, fontSize: 12.5 }}
          />
          <button type="button" className="btn btn--secondary" onClick={handleUpdateSeed}>
            <RotateCcw size={14} aria-hidden="true" />
            <span>Lock seed</span>
          </button>
        </div>
        {seedNotice && (
          <p
            role="status"
            className="callout callout--pass"
            style={{ margin: 0, fontSize: 12.5 }}
          >
            {seedNotice}
          </p>
        )}
      </div>

      <div className="field">
        <span className="field__label">
          <span>Benchtop concordance (Simulated reference)</span>
          <span className="field__value">
            {LAB_BENCHMARK_SERIES.length} split samples
          </span>
        </span>

        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Sample</th>
                <th scope="col" className="table__num">
                  Target mg/L
                </th>
                <th scope="col" className="table__num">
                  Lab UV-Vis
                </th>
                <th scope="col" className="table__num">
                  LISA prototype
                </th>
                <th scope="col" className="table__num">
                  Error
                </th>
                <th scope="col">Concordance</th>
              </tr>
            </thead>
            <tbody>
              {LAB_BENCHMARK_SERIES.map((row) => (
                <tr key={row.sampleId}>
                  <td className="table__strong">{row.sampleLabel}</td>
                  <td className="table__num">{row.trueConcMgL.toFixed(2)}</td>
                  <td className="table__num" style={{ color: 'var(--ink-2)' }}>
                    {row.uvVisConcMgL.toFixed(3)}
                    <span style={{ color: 'var(--ink-3)' }}> (A={row.uvVisBenchtopAbs650})</span>
                  </td>
                  <td className="table__num" style={{ color: 'var(--accent)' }}>
                    {row.lisaConcMgL.toFixed(3)}
                    <span style={{ color: 'var(--ink-3)' }}> (A={row.lisaAbs650})</span>
                  </td>
                  <td className="table__num">{row.relativeErrorPercent}%</td>
                  <td>
                    <StatusPill
                      tone={
                        row.concordanceStatus === 'EXCELLENT'
                          ? 'pass'
                          : row.concordanceStatus === 'GOOD'
                            ? 'accent'
                            : 'caution'
                      }
                    >
                      {row.concordanceStatus.charAt(0) +
                        row.concordanceStatus.slice(1).toLowerCase()}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
};
