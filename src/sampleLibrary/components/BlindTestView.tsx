// LISA: Blind Sample Test View Component
// Sealed ground-truth hackathon demonstration mode.
// The user selects a coded blind vial (#B-01 through #B-08), runs LISA, inspects model predictions,
// and then unseals ground truth to verify prediction accuracy.

import React, { useState } from 'react';
import { BlindVial, ScenarioRunResult } from '../types';
import { PREDEFINED_BLIND_VIALS, executeBlindVialTest } from '../blindManager';
import { Unlock, Play, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';

export const BlindTestView: React.FC = () => {
  const [selectedVial, setSelectedVial] = useState<BlindVial>(PREDEFINED_BLIND_VIALS[2]); // Default B-03 (0.40 mg/L)
  const [runResult, setRunResult] = useState<ScenarioRunResult | null>(null);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const handleSelectVial = (vial: BlindVial) => {
    setSelectedVial(vial);
    setRunResult(null);
    setIsRevealed(false);
  };

  const handleNewRandomVial = () => {
    const remaining = PREDEFINED_BLIND_VIALS.filter((v) => v.code !== selectedVial.code);
    const nextVial = remaining[Math.floor(Math.random() * remaining.length)];
    handleSelectVial(nextVial);
  };

  const handleRunBlindTest = () => {
    setIsRunning(true);
    setIsRevealed(false);
    setTimeout(() => {
      const res = executeBlindVialTest(selectedVial);
      setRunResult(res);
      setIsRunning(false);
    }, 450);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Banner */}
      <div
        style={{
          background: 'var(--surface-sunken)',
          padding: '14px 18px',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--line)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Unbiased Validation Lab
          </span>
          <h3 style={{ margin: '2px 0 0', fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>
            Blind Sample Verification Protocol
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ink-2)' }}>
            Ground truth concentration is mathematically sealed and inaccessible in the UI until LISA commits to an optical prediction.
          </p>
        </div>

        <button
          type="button"
          className="btn btn--secondary"
          onClick={handleNewRandomVial}
          style={{ padding: '8px 14px' }}
        >
          <RefreshCw size={13} aria-hidden="true" />
          <span>New Blind Sample</span>
        </button>
      </div>

      {/* Vial Selector Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: 10,
        }}
      >
        {PREDEFINED_BLIND_VIALS.map((vial) => {
          const isSelected = vial.code === selectedVial.code;
          return (
            <button
              key={vial.code}
              type="button"
              className="card"
              style={{
                padding: '12px 10px',
                textAlign: 'center',
                borderRadius: 'var(--r-sm)',
                border: isSelected ? '2px solid var(--accent)' : '1px solid var(--line)',
                background: isSelected ? 'var(--surface-sunken)' : 'var(--surface-raised)',
                cursor: 'pointer',
              }}
              onClick={() => handleSelectVial(vial)}
            >
              <div
                className="mono"
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: isSelected ? 'var(--accent)' : 'var(--ink-3)',
                }}
              >
                {vial.code}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 4 }}>
                Vial #{vial.code}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Blind Card */}
      <div
        style={{
          background: 'var(--surface-raised)',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--line)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 18,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div
            className="badge"
            style={{
              background: 'rgba(22, 24, 29, 0.85)',
              color: '#ffffff',
              fontSize: 12,
              padding: '4px 12px',
            }}
          >
            BLIND SAMPLE #{selectedVial.code}
          </div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            {selectedVial.displayName}
          </h2>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-2)', maxWidth: 460 }}>
            {selectedVial.hint}
          </p>
        </div>

        {/* Action Button */}
        <button
          type="button"
          className="btn btn--primary"
          onClick={handleRunBlindTest}
          disabled={isRunning}
          style={{ padding: '12px 28px', fontSize: 14 }}
        >
          <Play size={16} aria-hidden="true" />
          <span>{isRunning ? 'Analyzing Blind Optics…' : 'Run LISA on Blind Vial'}</span>
        </button>

        {/* Prediction Display */}
        {runResult && (
          <div
            style={{
              width: '100%',
              maxWidth: 540,
              background: 'var(--surface-sunken)',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--line)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              alignItems: 'center',
            }}
          >
            <div>
              <span style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block' }}>
                LISA Optical Reading (Committed)
              </span>
              <div
                className="tnum"
                style={{
                  fontSize: 38,
                  fontWeight: 700,
                  letterSpacing: '-0.04em',
                  color: runResult.isRejected ? 'var(--alert)' : 'var(--ink)',
                  marginTop: 4,
                }}
              >
                {runResult.isRejected ? (
                  'REJECTED'
                ) : (
                  <>
                    {runResult.predictedConcentration?.toFixed(2)}
                    <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink-2)', marginLeft: 8 }}>
                      ± {runResult.uncertainty?.toFixed(2)} {runResult.unit}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* QC / OOD Badges */}
            <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--r-sm)',
                  background: runResult.qcStatus === 'PASS' ? 'var(--pass-quiet)' : 'var(--alert-quiet)',
                  color: runResult.qcStatus === 'PASS' ? 'var(--pass)' : 'var(--alert)',
                  fontWeight: 600,
                }}
              >
                QC: {runResult.qcPassedChecks}/{runResult.qcTotalChecks} passed
              </span>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--r-sm)',
                  background: runResult.oodStatus === 'IN_DISTRIBUTION' ? 'var(--pass-quiet)' : 'var(--alert-quiet)',
                  color: runResult.oodStatus === 'IN_DISTRIBUTION' ? 'var(--pass)' : 'var(--alert)',
                  fontWeight: 600,
                }}
              >
                OOD: {runResult.oodStatus}
              </span>
            </div>

            {/* Reveal Mechanism */}
            {!isRevealed ? (
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setIsRevealed(true)}
                style={{ marginTop: 6 }}
              >
                <Unlock size={14} aria-hidden="true" />
                <span>Unseal Ground Truth</span>
              </button>
            ) : (
              <div
                style={{
                  width: '100%',
                  borderTop: '1px solid var(--line)',
                  paddingTop: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <div style={{ background: 'var(--surface-raised)', padding: 10, borderRadius: 'var(--r-sm)' }}>
                    <span style={{ color: 'var(--ink-3)', fontSize: 10.5, display: 'block' }}>GROUND TRUTH</span>
                    <span className="mono tnum" style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 16 }}>
                      {selectedVial.groundTruthConcentration.toFixed(2)} mg/L
                    </span>
                  </div>
                  <div style={{ background: 'var(--surface-raised)', padding: 10, borderRadius: 'var(--r-sm)' }}>
                    <span style={{ color: 'var(--ink-3)', fontSize: 10.5, display: 'block' }}>ABSOLUTE ERROR</span>
                    <span className="mono tnum" style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 16 }}>
                      {runResult.absoluteError !== null ? `${runResult.absoluteError.toFixed(3)} mg/L` : '—'}
                    </span>
                  </div>
                  <div style={{ background: 'var(--surface-raised)', padding: 10, borderRadius: 'var(--r-sm)' }}>
                    <span style={{ color: 'var(--ink-3)', fontSize: 10.5, display: 'block' }}>RELATIVE ERROR</span>
                    <span
                      className="mono tnum"
                      style={{
                        fontWeight: 600,
                        color: runResult.isAccurateWithinTolerance ? 'var(--pass)' : 'var(--alert)',
                        fontSize: 16,
                      }}
                    >
                      {runResult.relativeErrorPercent !== null ? `${runResult.relativeErrorPercent.toFixed(1)}%` : '—'}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    color: runResult.isAccurateWithinTolerance ? 'var(--pass)' : 'var(--alert)',
                  }}
                >
                  {runResult.isAccurateWithinTolerance ? (
                    <>
                      <CheckCircle size={16} /> VALIDATION PASSED (within ±{selectedVial.toleranceMgL} mg/L tolerance)
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={16} /> OUTSIDE TOLERANCE
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
