// LISA: Sample Detail View Component
// Shows source context visual, scenario parameters, [RUN LISA], real inference results,
// [REVEAL SIMULATION TRUTH] with error analysis, and [REPLAY SAMPLE].

import React, { useState } from 'react';
import { SampleScenario, ScenarioRunResult } from '../types';
import { runSampleScenario } from '../runner';
import { WhatWouldLISASee } from './WhatWouldLISASee';
import { Play, RotateCcw, Lock, Unlock, CheckCircle, AlertTriangle, XCircle, ArrowLeft } from 'lucide-react';

interface SampleDetailViewProps {
  scenario: SampleScenario;
  onBack: () => void;
  onApplyToMainApp?: (scenario: SampleScenario) => void;
}

export const SampleDetailView: React.FC<SampleDetailViewProps> = ({
  scenario,
  onBack,
  onApplyToMainApp,
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [runResult, setRunResult] = useState<ScenarioRunResult | null>(null);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);

  const handleRun = () => {
    setIsRunning(true);
    setIsRevealed(false);

    // Staged timeout to simulate physical optical acquisition & inference
    setTimeout(() => {
      const { runResult: res } = runSampleScenario(scenario);
      setRunResult(res);
      setIsRunning(false);
    }, 450);
  };

  const handleReplay = () => {
    if (!runResult) return;
    setIsRunning(true);
    setTimeout(() => {
      // Re-run with the exact same deterministic seed
      const { runResult: replayed } = runSampleScenario(scenario, {
        seedOverride: runResult.seed,
      });
      setRunResult(replayed);
      setIsRunning(false);
    }, 350);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Back button and title bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={onBack}
          style={{ padding: '6px 12px' }}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Back to Library</span>
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          <span className="badge" style={{ background: 'var(--surface-sunken)' }}>
            Provenance: {scenario.provenance}
          </span>
          <span className="badge" style={{ background: 'var(--surface-sunken)' }}>
            {scenario.sourceType}
          </span>
        </div>
      </div>

      {/* Main Grid: Visual & Context / Optical Parameters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: 20 }}>
        {/* Left Column: Visual card */}
        <div
          style={{
            background: 'var(--surface-raised)',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--line)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: 200,
              borderRadius: 'var(--r-sm)',
              overflow: 'hidden',
              background: 'var(--surface-inset)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {scenario.sourceVisual.svgDataUri && (
              <img
                src={scenario.sourceVisual.svgDataUri}
                alt={scenario.sourceVisual.title}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            )}
          </div>

          <div>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase' }}>
              Source Context
            </span>
            <h3 style={{ margin: '2px 0 6px', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
              {scenario.name}
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.45 }}>
              {scenario.description}
            </p>
          </div>

          <div
            style={{
              fontSize: 11.5,
              color: 'var(--ink-3)',
              borderTop: '1px solid var(--line)',
              paddingTop: 10,
              lineHeight: 1.4,
            }}
          >
            <strong>Scientific Provenance:</strong> {scenario.provenanceDetails}
          </div>
        </div>

        {/* Right Column: Measurement actions & Live results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Optical parameters summary */}
          <div
            style={{
              background: 'var(--surface-sunken)',
              padding: '14px 18px',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--line)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 12,
              fontSize: 12,
            }}
          >
            <div>
              <span style={{ color: 'var(--ink-3)', display: 'block', fontSize: 11 }}>MEASUREMENT</span>
              <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Simulated Optics</span>
            </div>
            <div>
              <span style={{ color: 'var(--ink-3)', display: 'block', fontSize: 11 }}>NOISE LEVEL</span>
              <span className="mono tnum" style={{ fontWeight: 600, color: 'var(--ink)' }}>
                {scenario.simulation.noiseLevel.toFixed(3)}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--ink-3)', display: 'block', fontSize: 11 }}>TURBIDITY</span>
              <span className="mono tnum" style={{ fontWeight: 600, color: 'var(--ink)' }}>
                {scenario.simulation.turbidityAU.toFixed(2)} AU
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--ink-3)', display: 'block', fontSize: 11 }}>OPTICAL SHIFT</span>
              <span className="mono tnum" style={{ fontWeight: 600, color: 'var(--ink)' }}>
                {scenario.simulation.shiftPx} px
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--ink-3)', display: 'block', fontSize: 11 }}>SENSOR STATE</span>
              <span
                style={{
                  fontWeight: 600,
                  color: scenario.simulation.isSaturated ? 'var(--alert)' : 'var(--pass)',
                }}
              >
                {scenario.simulation.isSaturated ? 'Clipped (255)' : 'Linear'}
              </span>
            </div>
          </div>

          {/* Primary Action Button Bar */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn--primary"
              style={{ flex: 1, padding: '12px 20px', fontSize: 14 }}
              onClick={handleRun}
              disabled={isRunning}
            >
              <Play size={16} aria-hidden="true" />
              <span>{isRunning ? 'Processing Optical Pipeline…' : 'Run LISA Measurement'}</span>
            </button>

            {runResult && (
              <button
                type="button"
                className="btn btn--secondary"
                style={{ padding: '12px 16px' }}
                onClick={handleReplay}
                disabled={isRunning}
                title="Re-run with exact deterministic seed"
              >
                <RotateCcw size={15} aria-hidden="true" />
                <span>Replay</span>
              </button>
            )}

            {onApplyToMainApp && (
              <button
                type="button"
                className="btn btn--secondary"
                style={{ padding: '12px 16px' }}
                onClick={() => onApplyToMainApp(scenario)}
                title="Load these optical parameters into the main instrument workspace"
              >
                <span>Load in Instrument</span>
              </button>
            )}
          </div>

          {/* Result Card when executed */}
          {runResult && (
            <div
              style={{
                background: 'var(--surface-raised)',
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--line)',
                padding: '20px 22px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase' }}>
                    Production Pipeline Inference Output
                  </span>
                  <div
                    className="tnum"
                    style={{
                      fontSize: 34,
                      fontWeight: 600,
                      color: runResult.isRejected ? 'var(--alert)' : 'var(--ink)',
                      letterSpacing: '-0.03em',
                      lineHeight: 1.1,
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

                <div style={{ textAlign: 'right' }}>
                  <span
                    className="badge"
                    style={{
                      background:
                        runResult.verdict === 'SAFE'
                          ? 'var(--pass-quiet)'
                          : runResult.verdict === 'ALERT' || runResult.verdict === 'REJECTED'
                          ? 'var(--alert-quiet)'
                          : 'var(--caution-quiet)',
                      color:
                        runResult.verdict === 'SAFE'
                          ? 'var(--pass)'
                          : runResult.verdict === 'ALERT' || runResult.verdict === 'REJECTED'
                          ? 'var(--alert)'
                          : 'var(--caution)',
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '4px 10px',
                    }}
                  >
                    {runResult.verdict}
                  </span>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                    Model: {runResult.selectedModel}
                  </div>
                </div>
              </div>

              {/* QC and OOD Badges */}
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12.5,
                    color: runResult.qcStatus === 'PASS' ? 'var(--pass)' : 'var(--alert)',
                    background: runResult.qcStatus === 'PASS' ? 'var(--pass-quiet)' : 'var(--alert-quiet)',
                    padding: '6px 12px',
                    borderRadius: 'var(--r-sm)',
                  }}
                >
                  {runResult.qcStatus === 'PASS' ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
                  <span>QC Status: {runResult.qcPassedChecks}/{runResult.qcTotalChecks} checks passed ({runResult.qcStatus})</span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12.5,
                    color: runResult.oodStatus === 'IN_DISTRIBUTION' ? 'var(--pass)' : 'var(--alert)',
                    background: runResult.oodStatus === 'IN_DISTRIBUTION' ? 'var(--pass-quiet)' : 'var(--alert-quiet)',
                    padding: '6px 12px',
                    borderRadius: 'var(--r-sm)',
                  }}
                >
                  {runResult.oodStatus === 'IN_DISTRIBUTION' ? <CheckCircle size={15} /> : <XCircle size={15} />}
                  <span>OOD Anomaly Score: {runResult.oodScore.toFixed(2)} ({runResult.oodStatus})</span>
                </div>
              </div>

              {/* Rejection message if rejected */}
              {runResult.isRejected && (
                <div
                  style={{
                    background: 'var(--alert-quiet)',
                    border: '1px solid var(--alert)',
                    borderRadius: 'var(--r-sm)',
                    padding: '10px 14px',
                    fontSize: 12.5,
                    color: 'var(--alert)',
                    fontWeight: 500,
                  }}
                >
                  {runResult.rejectionReason}
                </div>
              )}

              {/* Reveal Simulation Truth Section */}
              <div
                style={{
                  borderTop: '1px solid var(--line)',
                  paddingTop: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {!isRevealed ? (
                  <button
                    type="button"
                    className="btn btn--secondary"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() => setIsRevealed(true)}
                  >
                    <Unlock size={14} aria-hidden="true" />
                    <span>Reveal Simulation Truth & Error Validation</span>
                  </button>
                ) : (
                  <div
                    style={{
                      background: 'var(--surface-sunken)',
                      borderRadius: 'var(--r-sm)',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
                        Simulation Ground Truth Unsealed
                      </span>
                      <button
                        type="button"
                        className="btn btn--secondary"
                        style={{ padding: '2px 8px', fontSize: 11 }}
                        onClick={() => setIsRevealed(false)}
                      >
                        <Lock size={12} aria-hidden="true" />
                        <span>Hide</span>
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: 12 }}>
                      <div>
                        <span style={{ color: 'var(--ink-3)', display: 'block', fontSize: 11 }}>GROUND TRUTH</span>
                        <span className="mono tnum" style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 15 }}>
                          {scenario.groundTruth.concentration.toFixed(2)} {scenario.groundTruth.unit}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--ink-3)', display: 'block', fontSize: 11 }}>ABSOLUTE ERROR</span>
                        <span className="mono tnum" style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 15 }}>
                          {runResult.absoluteError !== null ? `${runResult.absoluteError.toFixed(3)} mg/L` : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--ink-3)', display: 'block', fontSize: 11 }}>RELATIVE ERROR</span>
                        <span
                          className="mono tnum"
                          style={{
                            fontWeight: 600,
                            color: runResult.isAccurateWithinTolerance ? 'var(--pass)' : 'var(--alert)',
                            fontSize: 15,
                          }}
                        >
                          {runResult.relativeErrorPercent !== null ? `${runResult.relativeErrorPercent.toFixed(1)}%` : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.4, marginTop: 4 }}>
                      <strong>Tolerance Standard:</strong> {scenario.tolerance?.origin || 'EPA 365.3 field validation metric.'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* "What Would LISA See?" Signal Flow Visualization */}
      <WhatWouldLISASee scenario={scenario} runResult={runResult} />
    </div>
  );
};
