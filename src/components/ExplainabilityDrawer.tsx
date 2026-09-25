// LISA: Explainability
// Answers "why this result?" as four plain-language steps, with the raw
// provenance chain available underneath. Reads like a system explanation, not
// a logs dump.

import React from 'react';
import { Volume2 } from 'lucide-react';
import { ScientificExplanation } from '../types';
import { Modal } from './ui/Modal';
import { Disclosure } from './ui/Disclosure';

interface ExplainabilityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  explanation: ScientificExplanation | null;
  onSpeakHindi: () => void;
}

export const ExplainabilityDrawer: React.FC<ExplainabilityDrawerProps> = ({
  isOpen,
  onClose,
  explanation,
  onSpeakHindi,
}) => {
  if (!explanation) return null;

  const modelStep =
    explanation.technicalDetails.find((d) => d.startsWith('Predictive Model')) ??
    explanation.technicalDetails[0];

  const steps: { name: string; body: string; meta?: string }[] = [
    {
      name: 'Optical signal',
      body: explanation.absorbanceCharacteristic,
      meta: explanation.dominantSpectralRegion,
    },
    {
      name: 'Calibration',
      body: explanation.beerLambertConsistency,
    },
    {
      name: 'Model',
      body: modelStep,
    },
    {
      name: 'Confidence',
      body: explanation.oodAssessment,
      meta: explanation.qcSummary,
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Why did LISA calculate this?"
      subtitle={explanation.headline}
      size="default"
    >
      <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)' }}>
        {explanation.simpleLanguageSummary}
      </p>

      <div className="steps">
        {steps.map((step, idx) => (
          <div className="step" key={step.name}>
            <span className="step__marker" aria-hidden="true">
              {idx + 1}
            </span>
            <div className="step__text">
              <span className="step__name">{step.name}</span>
              <span className="step__detail">{step.body}</span>
              {step.meta && (
                <span className="step__detail" style={{ color: 'var(--ink-2)', marginTop: 3 }}>
                  {step.meta}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Accessible readout in Hindi */}
      <div
        style={{
          background: 'var(--surface-sunken)',
          borderRadius: 'var(--r-md)',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}>
            हिंदी में स्पष्टीकरण
          </span>
          <span style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
            {explanation.hindiSummary}
          </span>
        </div>
        <button type="button" className="btn btn--secondary btn--sm" onClick={onSpeakHindi}>
          <Volume2 size={14} aria-hidden="true" />
          <span>सुनें</span>
        </button>
      </div>

      <Disclosure label="Technical details">
        <div className="stack" style={{ gap: 10 }}>
          {explanation.technicalDetails.map((detail, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span
                className="mono"
                style={{ fontSize: 11.5, color: 'var(--ink-3)', paddingTop: 2, flexShrink: 0 }}
              >
                {String(idx + 1).padStart(2, '0')}
              </span>
              <span style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                {detail}
              </span>
            </div>
          ))}
        </div>
      </Disclosure>
    </Modal>
  );
};
