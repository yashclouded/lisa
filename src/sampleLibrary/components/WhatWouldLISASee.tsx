// LISA: "What Would LISA See?" Scientific Signal Flow Component
// Visualizes the complete physical to digital transmission chain:
// Source Context -> Optical Setup -> Dispersed Spectrum -> Absorbance -> ML Model -> QC/OOD -> Result.
// All values and traces come strictly from genuine production execution arrays.

import React from 'react';
import { SampleScenario, ScenarioRunResult } from '../types';
import { ArrowDown, CheckCircle, XCircle } from 'lucide-react';

interface WhatWouldLISASeeProps {
  scenario: SampleScenario;
  runResult: ScenarioRunResult | null;
}

export const WhatWouldLISASee: React.FC<WhatWouldLISASeeProps> = ({
  scenario,
  runResult,
}) => {
  return (
    <div
      style={{
        background: 'var(--surface-sunken)',
        borderRadius: 'var(--r-md)',
        padding: '18px 20px',
        border: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Optical Chain Verification
          </span>
          <h4 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
            What Would LISA See?
          </h4>
        </div>
        <span className="badge" style={{ fontSize: 10 }}>
          EPA 365.3 Standard Path
        </span>
      </div>

      {/* Stage 1: Water Source Context */}
      <div className="flow-stage" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--surface-raised)',
            border: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--accent)',
            flexShrink: 0,
          }}
        >
          1
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
            Environmental Water Source Context
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
            {scenario.sourceType} • {scenario.name} (Contextual sample scene only, not direct spectral input)
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '-6px 0' }}>
        <ArrowDown size={14} color="var(--ink-3)" />
      </div>

      {/* Stage 2: Optical Setup & Reagent Reaction */}
      <div className="flow-stage" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--surface-raised)',
            border: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--accent)',
            flexShrink: 0,
          }}
        >
          2
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
            Chromophore Reaction & Optical Aperture
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
            Ascorbic acid reduction → Phosphomolybdate blue (λmax ~ 680 nm) • 1.0 cm standard cuvette • 1000 lines/mm transmission grating
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '-6px 0' }}>
        <ArrowDown size={14} color="var(--ink-3)" />
      </div>

      {/* Stage 3: Raw Transmission Spectrum */}
      <div className="flow-stage" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--surface-raised)',
            border: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--accent)',
            flexShrink: 0,
          }}
        >
          3
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
            CMOS Dispersed Transmission Profile I(λ)
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
            {runResult ? (
              <>
                151 channels (400–700 nm) • Cross-correlation shift:{' '}
                <span className="mono tnum">{runResult.shiftPx > 0 ? `+${runResult.shiftPx}` : runResult.shiftPx} px</span>
              </>
            ) : (
              '151-channel spatial binning across horizontal ROI'
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '-6px 0' }}>
        <ArrowDown size={14} color="var(--ink-3)" />
      </div>

      {/* Stage 4: Absorbance Calculation */}
      <div className="flow-stage" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--surface-raised)',
            border: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--accent)',
            flexShrink: 0,
          }}
        >
          4
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
            Optical Absorbance & Zero-Offset Baseline
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
            {runResult ? (
              <>
                A(λ) = −log₁₀(I_sample / I_blank) • Peak A at 680 nm:{' '}
                <span className="mono tnum">
                  {Math.max(...runResult.absorbances).toFixed(3)} AU
                </span>
              </>
            ) : (
              'Logarithmic transmission ratio corrected for baseline offset'
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '-6px 0' }}>
        <ArrowDown size={14} color="var(--ink-3)" />
      </div>

      {/* Stage 5: Dual Model Inference */}
      <div className="flow-stage" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--surface-raised)',
            border: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--accent)',
            flexShrink: 0,
          }}
        >
          5
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
            Model Selection & Concentration Estimation
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
            {runResult ? (
              <>
                Selected model:{' '}
                <span className="mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>
                  {runResult.selectedModel}
                </span>{' '}
                (Ridge LOOCV RMSE: {runResult.ridgeMetrics.loocvRmse?.toFixed(3) ?? '—'} mg/L)
              </>
            ) : (
              'Grouped CV selection between Beer-Lambert band model & 151-channel Ridge'
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '-6px 0' }}>
        <ArrowDown size={14} color="var(--ink-3)" />
      </div>

      {/* Stage 6: QC & OOD Manifold Check */}
      <div className="flow-stage" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--surface-raised)',
            border: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--accent)',
            flexShrink: 0,
          }}
        >
          6
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
            Automated QC & Out-Of-Distribution Anomaly Gating
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
            {runResult ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {runResult.isRejected ? (
                  <XCircle size={13} color="var(--alert)" />
                ) : (
                  <CheckCircle size={13} color="var(--pass)" />
                )}
                QC: {runResult.qcPassedChecks}/{runResult.qcTotalChecks} passed • OOD Score:{' '}
                <span className="mono tnum">{runResult.oodScore.toFixed(2)}</span> ({runResult.oodStatus})
              </span>
            ) : (
              '5-tier optical sanity checks + Mahalanobis calibration distance'
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '-6px 0' }}>
        <ArrowDown size={14} color="var(--ink-3)" />
      </div>

      {/* Stage 7: Certified Final Result */}
      <div
        className="flow-stage"
        style={{
          display: 'flex',
          gap: 14,
          alignItems: 'center',
          background: 'var(--surface-raised)',
          padding: '10px 14px',
          borderRadius: 'var(--r-sm)',
          border: '1px solid var(--line)',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: runResult?.isRejected ? 'var(--alert-quiet)' : 'var(--pass-quiet)',
            border: `1px solid ${runResult?.isRejected ? 'var(--alert)' : 'var(--pass)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
            color: runResult?.isRejected ? 'var(--alert)' : 'var(--pass)',
            flexShrink: 0,
          }}
        >
          7
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            Final Scientific Output & Uncertainty
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
            {runResult ? (
              runResult.isRejected ? (
                <span style={{ color: 'var(--alert)', fontWeight: 500 }}>
                  REFUSED TO REPORT NUMBER ({runResult.rejectionReason})
                </span>
              ) : (
                <span className="tnum" style={{ fontWeight: 600, color: 'var(--ink)' }}>
                  {runResult.predictedConcentration?.toFixed(2)} ± {runResult.uncertainty?.toFixed(2)} {runResult.unit} ({runResult.verdict})
                </span>
              )
            ) : (
              'Awaiting measurement execution'
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
