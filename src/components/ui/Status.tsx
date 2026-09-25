// LISA: Status primitives.
// Colour is never the only signal — every status carries a word, and a glyph
// wherever space allows, so it survives greyscale and colour-blind rendering.

import React from 'react';
import { Check, AlertTriangle, X, Minus } from 'lucide-react';
import { QCStatus, VerdictStatus } from '../../types';

export type Tone = 'pass' | 'caution' | 'alert' | 'neutral' | 'accent';

export const QC_TONE: Record<QCStatus, Tone> = {
  PASS: 'pass',
  WARNING: 'caution',
  FAIL: 'alert',
};

export const QC_WORD: Record<QCStatus, string> = {
  PASS: 'Pass',
  WARNING: 'Advisory',
  FAIL: 'Fail',
};

export const VERDICT_TONE: Record<VerdictStatus, Tone> = {
  SAFE: 'pass',
  CAUTION: 'caution',
  ALERT: 'alert',
  REJECTED: 'alert',
};

export const StatusPill: React.FC<{ tone: Tone; children: React.ReactNode }> = ({
  tone,
  children,
}) => (
  <span className={`status-pill status-pill--${tone}`}>
    <span className="status-pill__dot" aria-hidden="true" />
    {children}
  </span>
);

export const StatusDot: React.FC<{ tone: Tone; children: React.ReactNode }> = ({
  tone,
  children,
}) => (
  <span className={`status status--${tone}`}>
    <span className="status__dot" aria-hidden="true" />
    {children}
  </span>
);

/** Glyph for a QC row — shape differs per state, so it reads without colour. */
export const CheckGlyph: React.FC<{ status: QCStatus }> = ({ status }) => {
  if (status === 'PASS') {
    return <Check className="trust__icon icon-pass" size={15} aria-hidden="true" />;
  }
  if (status === 'WARNING') {
    return <AlertTriangle className="trust__icon icon-caution" size={15} aria-hidden="true" />;
  }
  return <X className="trust__icon icon-alert" size={15} aria-hidden="true" />;
};

export const NeutralGlyph: React.FC = () => (
  <Minus className="trust__icon icon-neutral" size={15} aria-hidden="true" />
);
