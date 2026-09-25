// LISA: Blind sample test
// Ground truth stays sealed until LISA has already committed to a reading.

import React, { useState } from 'react';
import { Check, LockKeyhole } from 'lucide-react';
import { CURATED_DEMO_SAMPLES, DemoSample } from '../data/demoData';
import { Modal } from './ui/Modal';

interface BlindTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVialAndRun: (vial: DemoSample) => void;
  activeMeasurementConc: number | null;
  activeMeasurementUncertainty: number | null;
}

const vialLetter = (id: string) =>
  id.includes('vial-x') ? 'X' : id.includes('vial-y') ? 'Y' : 'Z';

export const BlindTestModal: React.FC<BlindTestModalProps> = ({
  isOpen,
  onClose,
  onSelectVialAndRun,
  activeMeasurementConc,
  activeMeasurementUncertainty,
}) => {
  const [selectedVialId, setSelectedVialId] = useState<string>('sample-vial-y');
  const [truthRevealed, setTruthRevealed] = useState<boolean>(false);

  const blindVials = CURATED_DEMO_SAMPLES.filter((s) =>
    ['sample-vial-x', 'sample-vial-y', 'sample-vial-z'].includes(s.id)
  );

  const selectedVial = blindVials.find((v) => v.id === selectedVialId) ?? blindVials[1];

  const handleTestVial = (vial: DemoSample) => {
    setSelectedVialId(vial.id);
    setTruthRevealed(false);
    onSelectVialAndRun(vial);
  };

  const percentError =
    activeMeasurementConc !== null && selectedVial.groundTruthConcentration > 0
      ? Math.abs(
          ((activeMeasurementConc - selectedVial.groundTruthConcentration) /
            selectedVial.groundTruthConcentration) *
            100
        ).toFixed(1)
      : '0.0';

  const withinTolerance = parseFloat(percentError) < 10;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Blind sample test"
      subtitle="Hand the operator a coded vial. Ground truth stays sealed until after LISA has committed to a number."
      size="default"
    >
      <div className="option-grid option-grid--3">
        {blindVials.map((vial) => {
          const selected = vial.id === selectedVialId;
          return (
            <button
              key={vial.id}
              type="button"
              className="option"
              aria-pressed={selected}
              onClick={() => handleTestVial(vial)}
            >
              <span
                className="mono"
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  color: selected ? 'var(--accent)' : 'var(--ink-3)',
                  letterSpacing: '-0.02em',
                }}
              >
                {vialLetter(vial.id)}
              </span>
              <span className="option__title">Vial {vialLetter(vial.id)}</span>
              <span className="option__meta">{vial.description}</span>
            </button>
          );
        })}
      </div>

      <div
        style={{
          background: 'var(--surface-sunken)',
          borderRadius: 'var(--r-md)',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
          LISA reading on the sensor
        </span>
        <span
          className="tnum"
          style={{
            fontSize: 40,
            fontWeight: 600,
            letterSpacing: '-0.04em',
            color: 'var(--ink)',
            lineHeight: 1.05,
          }}
        >
          {activeMeasurementConc !== null ? activeMeasurementConc.toFixed(2) : '—'}
          <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink-2)', marginLeft: 6 }}>
            ± {activeMeasurementUncertainty?.toFixed(2) ?? '—'} mg P/L
          </span>
        </span>

        {!truthRevealed ? (
          <button
            type="button"
            className="btn btn--secondary"
            style={{ marginTop: 8 }}
            onClick={() => setTruthRevealed(true)}
            disabled={activeMeasurementConc === null}
          >
            <LockKeyhole size={15} aria-hidden="true" />
            <span>Unseal ground truth</span>
          </button>
        ) : (
          <div
            style={{
              display: 'flex',
              gap: 28,
              marginTop: 12,
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <div className="groundtruth__item">
              <span className="groundtruth__label">Ground truth</span>
              <span className="groundtruth__value">
                {selectedVial.groundTruthConcentration.toFixed(2)} mg P/L
              </span>
            </div>
            <div className="groundtruth__item">
              <span className="groundtruth__label">Relative error</span>
              <span
                className="groundtruth__value"
                style={{ color: withinTolerance ? 'var(--pass)' : 'var(--caution)' }}
              >
                {percentError}%
              </span>
            </div>
            <div className="groundtruth__item">
              <span className="groundtruth__label">Assessment</span>
              <span
                className="groundtruth__value"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: withinTolerance ? 'var(--pass)' : 'var(--caution)',
                }}
              >
                {withinTolerance ? (
                  <>
                    <Check size={16} aria-hidden="true" /> Within tolerance
                  </>
                ) : (
                  'Outside tolerance'
                )}
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
