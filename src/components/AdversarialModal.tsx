// LISA: Adversarial samples
// The instrument's refusal behaviour, demonstrated rather than described.

import React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { CURATED_DEMO_SAMPLES, DemoSample } from '../data/demoData';
import { Modal } from './ui/Modal';
import { StatusPill } from './ui/Status';

interface AdversarialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAdversarialSample: (sample: DemoSample) => void;
}

export const AdversarialModal: React.FC<AdversarialModalProps> = ({
  isOpen,
  onClose,
  onSelectAdversarialSample,
}) => {
  const adversarialSamples = CURATED_DEMO_SAMPLES.filter((s) => s.isAdversarial);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Adversarial samples"
      subtitle="An in-field instrument must never guess a number when the sample chemistry is corrupted. These vials are deliberately broken — LISA should refuse them."
      size="default"
    >
      <div
        style={{
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-md)',
          overflow: 'hidden',
        }}
      >
        {adversarialSamples.map((sample, idx) => (
          <div
            key={sample.id}
            className="history-item"
            style={idx > 0 ? { borderTop: '1px solid var(--line)' } : undefined}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 13,
                flex: 1,
                minWidth: 0,
              }}
            >
              <AlertTriangle
                size={17}
                aria-hidden="true"
                style={{ color: 'var(--alert)', flexShrink: 0 }}
              />
              <span className="history-item__meta">
                <span className="history-item__name">{sample.name}</span>
                <span className="history-item__when">{sample.description}</span>
              </span>
            </span>

            <div className="history-item__actions">
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={() => {
                  onSelectAdversarialSample(sample);
                  onClose();
                }}
              >
                <span>Inject &amp; test</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="callout callout--neutral">
        <ShieldCheck size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <strong>Expected behaviour.</strong> An out-of-distribution distance above 3.0, or
          critical sensor clipping, triggers{' '}
          <span className="mono" style={{ fontSize: 12 }}>
            Measurement rejected
          </span>{' '}
          — the instrument reports no number at all rather than an unreliable one.
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <StatusPill tone="alert">Measurement rejected</StatusPill>
        <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
          is a valid, expected outcome — not a failure of the instrument.
        </span>
      </div>
    </Modal>
  );
};
