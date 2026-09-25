// LISA: Measurement quality (QC + OOD)
// Designed to be read in two seconds: a pass count, five plain-language rows,
// and the instrument's full numeric evidence one disclosure away.

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { QCReport, OODResult, QCCheckItem } from '../types';
import { CheckGlyph, NeutralGlyph, StatusPill, QC_TONE, QC_WORD, Tone } from './ui/Status';
import { Disclosure } from './ui/Disclosure';

interface QCPanelProps {
  qc: QCReport | null;
  ood: OODResult | null;
}

const OOD_TONE: Record<OODResult['status'], Tone> = {
  IN_DISTRIBUTION: 'pass',
  BORDERLINE: 'caution',
  OUT_OF_DISTRIBUTION: 'alert',
};

const OOD_WORD: Record<OODResult['status'], string> = {
  IN_DISTRIBUTION: 'In distribution',
  BORDERLINE: 'Borderline',
  OUT_OF_DISTRIBUTION: 'Outside distribution',
};

export const QCPanel: React.FC<QCPanelProps> = ({ qc, ood }) => {
  if (!qc || !ood) {
    return (
      <div className="card">
        <div className="card__head">
          <span className="card__title">Measurement quality</span>
        </div>
        <div className="empty">
          <ShieldCheck className="empty__icon" size={22} aria-hidden="true" />
          <span className="empty__title">Not yet assessed</span>
          <span className="empty__text">
            Quality checks run automatically on every capture.
          </span>
        </div>
      </div>
    );
  }

  const checks: QCCheckItem[] = [
    qc.signalStrengthCheck,
    qc.spectralShiftCheck,
    qc.calibrationRangeCheck,
    qc.turbidityInterferenceCheck,
    qc.saturationCheck,
  ];

  const passed = checks.filter((c) => c.status === 'PASS').length;

  return (
    <div className="card">
      <div className="card__head">
        <span className="card__title">Measurement quality</span>
        <StatusPill tone={QC_TONE[qc.overallStatus]}>
          {passed} of {checks.length} checks passed
        </StatusPill>
      </div>

      <div className="card__body" style={{ gap: 0, paddingTop: 12 }}>
        <div className="trust">
          {checks.map((check) => (
            <div className="trust__row" key={check.id}>
              <CheckGlyph status={check.status} />
              <span className="trust__name">{check.name}</span>
              <span className={`trust__state trust__state--${QC_TONE[check.status]}`}>
                {QC_WORD[check.status]}
              </span>
            </div>
          ))}

          <div className="trust__row">
            {ood.status === 'IN_DISTRIBUTION' ? (
              <NeutralGlyph />
            ) : (
              <CheckGlyph status={ood.status === 'BORDERLINE' ? 'WARNING' : 'FAIL'} />
            )}
            <span className="trust__name">Spectral distribution</span>
            <span className={`trust__state trust__state--${OOD_TONE[ood.status]}`}>
              {OOD_WORD[ood.status]}
            </span>
          </div>
        </div>

        <Disclosure label="View technical details">
          <div className="metrics" style={{ marginTop: 4 }}>
            {checks.map((check) => (
              <div className="metric" key={check.id}>
                <span className="metric__label">
                  {check.name}
                  <br />
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    Threshold {check.threshold}
                  </span>
                </span>
                <span className="metric__value">{check.value}</span>
              </div>
            ))}

            <div className="metric">
              <span className="metric__label">
                Distribution score
                <br />
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  Nearest standard {ood.nearestStandardConc.toFixed(2)} mg/L
                </span>
              </span>
              <span className="metric__value">{ood.score.toFixed(2)}</span>
            </div>
          </div>

          <p className="field__hint" style={{ marginTop: 12 }}>
            {ood.detail}
          </p>
          <p className="field__hint" style={{ marginTop: 6 }}>
            {qc.rejectionReason
              ? qc.rejectionReason
              : 'All optical parameters fall within the validated operating envelope of this instrument.'}
          </p>
        </Disclosure>
      </div>
    </div>
  );
};
