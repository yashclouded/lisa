// LISA: Stress Matrix & Batch Simulation Lab Component
// Runs 144-combination virtual field stress testing and batch library evaluation.

import React, { useState } from 'react';
import { BatchSimulationSummary, MatrixStressResult } from '../types';
import { runBatchSimulation } from '../batchRunner';
import { runStressMatrix } from '../matrixRunner';
import { Play, Activity, Layers, CheckCircle2, AlertOctagon } from 'lucide-react';

export const StressMatrixView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'batch' | 'matrix'>('batch');

  // Batch evaluation state
  const [batchResult, setBatchResult] = useState<BatchSimulationSummary | null>(null);
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);

  // Matrix stress state
  const [matrixResult, setMatrixResult] = useState<MatrixStressResult | null>(null);
  const [isMatrixRunning, setIsMatrixRunning] = useState<boolean>(false);

  const handleRunBatch = () => {
    setIsBatchRunning(true);
    setTimeout(() => {
      const summary = runBatchSimulation();
      setBatchResult(summary);
      setIsBatchRunning(false);
    }, 500);
  };

  const handleRunMatrix = () => {
    setIsMatrixRunning(true);
    setTimeout(() => {
      const mat = runStressMatrix();
      setMatrixResult(mat);
      setIsMatrixRunning(false);
    }, 600);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Sub-tab Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className={`btn ${activeSubTab === 'batch' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setActiveSubTab('batch')}
            style={{ padding: '6px 14px', fontSize: 13 }}
          >
            <Activity size={14} aria-hidden="true" />
            <span>Full Library Batch Evaluation</span>
          </button>
          <button
            type="button"
            className={`btn ${activeSubTab === 'matrix' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setActiveSubTab('matrix')}
            style={{ padding: '6px 14px', fontSize: 13 }}
          >
            <Layers size={14} aria-hidden="true" />
            <span>Virtual Field Stress Matrix (144 runs)</span>
          </button>
        </div>

        <div>
          {activeSubTab === 'batch' ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleRunBatch}
              disabled={isBatchRunning}
              style={{ padding: '8px 16px' }}
            >
              <Play size={14} aria-hidden="true" />
              <span>{isBatchRunning ? 'Executing Batch Suite…' : 'Run Batch Simulation'}</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleRunMatrix}
              disabled={isMatrixRunning}
              style={{ padding: '8px 16px' }}
            >
              <Play size={14} aria-hidden="true" />
              <span>{isMatrixRunning ? 'Computing 144 Optical Runs…' : 'Run Full Stress Matrix'}</span>
            </button>
          )}
        </div>
      </div>

      {/* View 1: Batch Simulation Summary */}
      {activeSubTab === 'batch' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!batchResult ? (
            <div
              style={{
                background: 'var(--surface-sunken)',
                borderRadius: 'var(--r-md)',
                padding: '40px 20px',
                textAlign: 'center',
                border: '1px solid var(--line)',
              }}
            >
              <Activity size={32} color="var(--accent)" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ margin: '0 0 6px', fontSize: 16, color: 'var(--ink)' }}>
                Batch Performance Evaluation
              </h4>
              <p style={{ margin: '0 auto 16px', maxWidth: 440, fontSize: 13, color: 'var(--ink-2)' }}>
                Automatically execute all 14 sample scenarios through the production pipeline to verify MAE, RMSE, bias, false acceptance, and rejection statistics.
              </p>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleRunBatch}
                disabled={isBatchRunning}
              >
                Start Automated Batch Run
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Metrics Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 10,
                }}
              >
                <MetricCard title="EVALUATED RUNS" value={`${batchResult.evaluatedRuns} / ${batchResult.totalScenarios}`} />
                <MetricCard title="MAE" value={`${batchResult.maeMgL.toFixed(3)} mg/L`} />
                <MetricCard title="RMSE" value={`${batchResult.rmseMgL.toFixed(3)} mg/L`} />
                <MetricCard title="MEAN BIAS" value={`${batchResult.meanBiasMgL > 0 ? '+' : ''}${batchResult.meanBiasMgL.toFixed(3)} mg/L`} />
                <MetricCard title="FALSE ACCEPTS" value={String(batchResult.falseAcceptanceCount)} highlight={batchResult.falseAcceptanceCount > 0 ? 'alert' : 'pass'} />
                <MetricCard title="FALSE REJECTS" value={String(batchResult.falseRejectionCount)} highlight={batchResult.falseRejectionCount > 0 ? 'alert' : 'pass'} />
                <MetricCard title="REJECTION RATE" value={`${batchResult.rejectionRatePercent.toFixed(1)}%`} />
              </div>

              {/* Table of Runs */}
              <div
                style={{
                  background: 'var(--surface-raised)',
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--line)',
                  overflow: 'hidden',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-sunken)', borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                      <th style={{ padding: '10px 14px' }}>Scenario</th>
                      <th style={{ padding: '10px 14px' }}>Truth</th>
                      <th style={{ padding: '10px 14px' }}>Predicted</th>
                      <th style={{ padding: '10px 14px' }}>Uncertainty</th>
                      <th style={{ padding: '10px 14px' }}>QC</th>
                      <th style={{ padding: '10px 14px' }}>OOD</th>
                      <th style={{ padding: '10px 14px' }}>Verdict</th>
                      <th style={{ padding: '10px 14px' }}>Behavior</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchResult.details.map((run) => (
                      <tr key={run.scenarioId} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{run.scenarioName}</td>
                        <td className="mono tnum" style={{ padding: '10px 14px' }}>
                          {run.groundTruthConcentration.toFixed(2)}
                        </td>
                        <td className="mono tnum" style={{ padding: '10px 14px', fontWeight: 600 }}>
                          {run.isRejected ? 'REJECTED' : run.predictedConcentration?.toFixed(2)}
                        </td>
                        <td className="mono tnum" style={{ padding: '10px 14px', color: 'var(--ink-2)' }}>
                          {run.uncertainty !== null ? `±${run.uncertainty.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span className={`badge ${run.qcStatus === 'PASS' ? 'badge--pass' : 'badge--alert'}`}>
                            {run.qcStatus}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: 11, color: run.oodStatus === 'IN_DISTRIBUTION' ? 'var(--pass)' : 'var(--alert)' }}>
                            {run.oodStatus}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>{run.verdict}</td>
                        <td style={{ padding: '10px 14px' }}>
                          {run.isExpectedBehaviorMatched ? (
                            <span style={{ color: 'var(--pass)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle2 size={13} /> Matched
                            </span>
                          ) : (
                            <span style={{ color: 'var(--alert)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <AlertOctagon size={13} /> Discrepancy
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* View 2: Stress Matrix Summary */}
      {activeSubTab === 'matrix' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!matrixResult ? (
            <div
              style={{
                background: 'var(--surface-sunken)',
                borderRadius: 'var(--r-md)',
                padding: '40px 20px',
                textAlign: 'center',
                border: '1px solid var(--line)',
              }}
            >
              <Layers size={32} color="var(--accent)" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ margin: '0 0 6px', fontSize: 16, color: 'var(--ink)' }}>
                Field Stress Grid (144 Combinations)
              </h4>
              <p style={{ margin: '0 auto 16px', maxWidth: 460, fontSize: 13, color: 'var(--ink-2)' }}>
                Stresses a 0.40 mg P/L baseline sample across:
                <br />
                <strong>Noise (3 levels) × Turbidity (3 levels) × Slit Shift (4 levels) × Handset Sensor (4 devices)</strong>
              </p>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleRunMatrix}
                disabled={isMatrixRunning}
              >
                Execute 144 Stress Runs
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Matrix Stats */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 10,
                }}
              >
                <MetricCard title="COMBINATIONS" value={String(matrixResult.totalCombinations)} />
                <MetricCard title="ACCEPTED RUNS" value={String(matrixResult.successfulEvaluations)} />
                <MetricCard title="REJECTION RATE" value={`${matrixResult.rejectionRate.toFixed(1)}%`} />
                <MetricCard title="MEAN ABS ERROR" value={`${matrixResult.meanAbsoluteError.toFixed(3)} mg/L`} />
                <MetricCard title="WORST ERROR" value={`${matrixResult.maxError.toFixed(3)} mg/L`} />
              </div>

              {/* Stress Grid Preview (First 30 cells) */}
              <div
                style={{
                  background: 'var(--surface-raised)',
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--line)',
                  padding: 16,
                  maxHeight: 400,
                  overflowY: 'auto',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-sunken)', textAlign: 'left' }}>
                      <th style={{ padding: '6px 10px' }}>Device</th>
                      <th style={{ padding: '6px 10px' }}>Noise</th>
                      <th style={{ padding: '6px 10px' }}>Turbidity</th>
                      <th style={{ padding: '6px 10px' }}>Shift</th>
                      <th style={{ padding: '6px 10px' }}>Predicted</th>
                      <th style={{ padding: '6px 10px' }}>Uncertainty</th>
                      <th style={{ padding: '6px 10px' }}>Abs Error</th>
                      <th style={{ padding: '6px 10px' }}>QC</th>
                      <th style={{ padding: '6px 10px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixResult.cells.map((c, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '6px 10px' }}>{c.deviceId.replace('device-', '').replace('-reference', ' ref')}</td>
                        <td className="mono" style={{ padding: '6px 10px' }}>{c.noiseLevel}</td>
                        <td className="mono" style={{ padding: '6px 10px' }}>{c.turbidityAU}</td>
                        <td className="mono" style={{ padding: '6px 10px' }}>{c.shiftPx}px</td>
                        <td className="mono" style={{ padding: '6px 10px', fontWeight: 600 }}>
                          {c.isRejected ? 'REJECTED' : c.predictedConcentration?.toFixed(2)}
                        </td>
                        <td className="mono" style={{ padding: '6px 10px' }}>{c.uncertainty ? `±${c.uncertainty.toFixed(2)}` : '—'}</td>
                        <td className="mono" style={{ padding: '6px 10px' }}>{c.absoluteError !== null ? c.absoluteError.toFixed(3) : '—'}</td>
                        <td style={{ padding: '6px 10px' }}>{c.qcStatus}</td>
                        <td style={{ padding: '6px 10px' }}>
                          <span style={{ color: c.isRejected ? 'var(--alert)' : 'var(--pass)' }}>
                            {c.isRejected ? 'Rejected' : 'Accepted'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const MetricCard: React.FC<{
  title: string;
  value: string;
  highlight?: 'pass' | 'alert' | 'normal';
}> = ({ title, value, highlight }) => (
  <div
    style={{
      background: 'var(--surface-raised)',
      padding: '10px 14px',
      borderRadius: 'var(--r-sm)',
      border: '1px solid var(--line)',
    }}
  >
    <span style={{ fontSize: 10.5, color: 'var(--ink-3)', display: 'block' }}>{title}</span>
    <span
      className="mono tnum"
      style={{
        fontSize: 18,
        fontWeight: 700,
        color:
          highlight === 'pass'
            ? 'var(--pass)'
            : highlight === 'alert'
            ? 'var(--alert)'
            : 'var(--ink)',
      }}
    >
      {value}
    </span>
  </div>
);
