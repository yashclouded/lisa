// LISA: Measurement result
// The hero surface. After a capture this is the loudest thing on the page —
// carried by type scale and whitespace, with no border, glow or gradient.

import React from 'react';
import { Volume2, FlaskConical, AlertTriangle } from 'lucide-react';
import { MeasurementRecord, AnalyteDefinition } from '../types';
import { StatusPill, VERDICT_TONE } from './ui/Status';

interface ResultCardProps {
  record: MeasurementRecord | null;
  currentAnalyte: AnalyteDefinition;
  onOpenExplanation: () => void;
  onSpeakResult: () => void;
  isScanning?: boolean;
}

export const ResultCard: React.FC<ResultCardProps> = ({
  record,
  currentAnalyte,
  onOpenExplanation,
  onSpeakResult,
  isScanning = false,
}) => {
  if (!record) {
    return (
      <div className="card">
        <div className="card__head">
          <span className="card__title">Result</span>
        </div>
        <div className="empty">
          <FlaskConical className="empty__icon" size={22} aria-hidden="true" />
          <span className="empty__title">
            {isScanning ? 'Analysing sample…' : 'No measurement yet'}
          </span>
          <span className="empty__text">
            {isScanning
              ? 'Running the optical pipeline.'
              : 'Choose a sample and capture to produce a reading.'}
          </span>
        </div>
      </div>
    );
  }

  const isRejected = record.isRejected || record.verdict === 'REJECTED';
  const tone = VERDICT_TONE[record.verdict];

  // The engine supplies the verdict label; split it so the status word leads
  // and its qualifier recedes, without altering the string itself.
  const [verdictHead, ...verdictRest] = record.verdictLabel.split(': ');
  const verdictDetail = verdictRest.join(': ');

  const hasRange = record.concentration !== null && record.uncertainty !== null;
  const lower = hasRange ? Math.max(0, (record.concentration as number) - (record.uncertainty as number)) : null;
  const upper = hasRange ? (record.concentration as number) + (record.uncertainty as number) : null;

  return (
    <div className="card">
      <div className="card__body">
        <div className="result">
          <div className="result__head">
            <span className="result__analyte">{record.analyteName}</span>
            <span className="result__sample">{record.sampleName}</span>
          </div>

          {isRejected ? (
            <>
              <div className="result__value-row">
                <span className="result__rejected-value">No result</span>
              </div>

              <p className="result__note" style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>
                Measurement rejected. The optical signature sits outside the validated
                calibration range, so LISA declined to report a number. Laboratory
                verification is recommended.
              </p>

              {record.rejectionReason && (
                <div className="callout callout--alert">
                  <span className="callout__icon" aria-hidden="true">
                    <AlertTriangle size={16} />
                  </span>
                  <span>{record.rejectionReason}</span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="result__value-row">
                <span className="result__value">
                  {record.concentration !== null ? record.concentration.toFixed(2) : '—'}
                </span>
                <span className="result__unit">{record.unit}</span>
              </div>

              <span className="result__ci">
                {hasRange
                  ? `± ${(record.uncertainty as number).toFixed(2)} ${record.unit} · 95% confidence interval (${lower?.toFixed(
                      2
                    )}–${upper?.toFixed(2)})`
                  : 'Uncertainty unavailable for this measurement'}
              </span>

              <div className="result__divider" />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <StatusPill tone={tone}>
                  {verdictHead}
                  {verdictDetail ? ` · ${verdictDetail}` : ''}
                </StatusPill>
                <span className="result__note">
                  Reference limit {currentAnalyte.alertThreshold.toFixed(2)}{' '}
                  {currentAnalyte.unit} · {currentAnalyte.standardReference}
                </span>
              </div>

              {record.groundTruth !== undefined && (
                <div className="groundtruth">
                  <div className="groundtruth__item">
                    <span className="groundtruth__label">Sealed ground truth</span>
                    <span className="groundtruth__value">
                      {record.groundTruth.toFixed(2)} {record.unit}
                    </span>
                  </div>
                  <div className="groundtruth__item" style={{ textAlign: 'right' }}>
                    <span className="groundtruth__label">Relative error</span>
                    <span
                      className="groundtruth__value"
                      style={{
                        color:
                          (record.percentError ?? 0) < 5 ? 'var(--pass)' : 'var(--caution)',
                      }}
                    >
                      {record.percentError !== undefined ? `${record.percentError}%` : '—'}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn--secondary"
              style={{ flex: 1 }}
              onClick={onOpenExplanation}
            >
              {isRejected ? 'Why did LISA refuse?' : 'Why did LISA calculate this?'}
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--icon"
              onClick={onSpeakResult}
              aria-label="Read this result aloud"
              title="Read this result aloud"
            >
              <Volume2 size={16} aria-hidden="true" />
            </button>
          </div>

          <p className="result__note">
            <strong>Note. </strong>
            {currentAnalyte.regulatoryNote}
          </p>
        </div>
      </div>
    </div>
  );
};
