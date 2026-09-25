// LISA: Sample Comparison View Component
// Side-by-side scientific comparison of Sample A vs Sample B.
// Compares source context, optical spectra, absorbance curves, concentration, uncertainty, QC, and OOD.

import React, { useState } from 'react';
import { SampleScenario, ScenarioRunResult } from '../types';
import { SAMPLE_SCENARIOS } from '../scenarios';
import { runSampleScenario } from '../runner';
import { Play } from 'lucide-react';

export const SampleComparisonView: React.FC = () => {
  const [sampleAId, setSampleAId] = useState<string>('scen-tap-water');
  const [sampleBId, setSampleBId] = useState<string>('scen-ag-runoff');

  const [resultA, setResultA] = useState<ScenarioRunResult | null>(null);
  const [resultB, setResultB] = useState<ScenarioRunResult | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const scenarioA = SAMPLE_SCENARIOS.find((s) => s.id === sampleAId) || SAMPLE_SCENARIOS[0];
  const scenarioB = SAMPLE_SCENARIOS.find((s) => s.id === sampleBId) || SAMPLE_SCENARIOS[4];

  const handleRunComparison = () => {
    setIsRunning(true);
    setTimeout(() => {
      const { runResult: resA } = runSampleScenario(scenarioA);
      const { runResult: resB } = runSampleScenario(scenarioB);
      setResultA(resA);
      setResultB(resB);
      setIsRunning(false);
    }, 400);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Selectors and run button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          background: 'var(--surface-sunken)',
          padding: '12px 18px',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--line)',
        }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flex: 1 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>
              SAMPLE A
            </label>
            <select
              className="select"
              value={sampleAId}
              onChange={(e) => {
                setSampleAId(e.target.value);
                setResultA(null);
              }}
              style={{ width: '100%' }}
            >
              {SAMPLE_SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.groundTruth.concentration} mg/L)
                </option>
              ))}
            </select>
          </div>

          <div style={{ fontWeight: 600, color: 'var(--ink-3)', fontSize: 13, alignSelf: 'flex-end', paddingBottom: 6 }}>
            vs
          </div>

          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>
              SAMPLE B
            </label>
            <select
              className="select"
              value={sampleBId}
              onChange={(e) => {
                setSampleBId(e.target.value);
                setResultB(null);
              }}
              style={{ width: '100%' }}
            >
              {SAMPLE_SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.groundTruth.concentration} mg/L)
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          className="btn btn--primary"
          onClick={handleRunComparison}
          disabled={isRunning}
          style={{ padding: '8px 18px', alignSelf: 'flex-end' }}
        >
          <Play size={14} aria-hidden="true" />
          <span>{isRunning ? 'Analyzing Both…' : 'Compare Optics'}</span>
        </button>
      </div>

      {/* Side-by-Side Comparison Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
        {/* Column A */}
        <ComparisonColumn scenario={scenarioA} result={resultA} label="SAMPLE A" />

        {/* Column B */}
        <ComparisonColumn scenario={scenarioB} result={resultB} label="SAMPLE B" />
      </div>
    </div>
  );
};

const ComparisonColumn: React.FC<{
  scenario: SampleScenario;
  result: ScenarioRunResult | null;
  label: string;
}> = ({ scenario, result, label }) => {
  const peakAbsorbance = result ? Math.max(...result.absorbances) : 0;

  return (
    <div
      style={{
        background: 'var(--surface-raised)',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--line)',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="badge" style={{ background: 'var(--surface-sunken)', fontWeight: 600 }}>
          {label}
        </span>
        <span className="badge" style={{ fontSize: 10 }}>
          {scenario.provenance}
        </span>
      </div>

      {/* Visual illustration */}
      <div
        style={{
          width: '100%',
          height: 140,
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
        <h4 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>
          {scenario.name}
        </h4>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.4 }}>
          {scenario.description}
        </p>
      </div>

      {/* Measurement Metrics */}
      <div
        style={{
          background: 'var(--surface-sunken)',
          padding: 12,
          borderRadius: 'var(--r-sm)',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
          fontSize: 12,
        }}
      >
        <div>
          <span style={{ color: 'var(--ink-3)', display: 'block', fontSize: 11 }}>PREDICTED CONC</span>
          <span className="tnum" style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 16 }}>
            {result
              ? result.isRejected
                ? 'REJECTED'
                : `${result.predictedConcentration?.toFixed(2)} ${result.unit}`
              : '—'}
          </span>
        </div>
        <div>
          <span style={{ color: 'var(--ink-3)', display: 'block', fontSize: 11 }}>UNCERTAINTY</span>
          <span className="tnum" style={{ fontWeight: 600, color: 'var(--ink-2)', fontSize: 16 }}>
            {result && result.uncertainty !== null ? `± ${result.uncertainty.toFixed(2)}` : '—'}
          </span>
        </div>
        <div>
          <span style={{ color: 'var(--ink-3)', display: 'block', fontSize: 11 }}>PEAK ABSORBANCE (680nm)</span>
          <span className="mono tnum" style={{ fontWeight: 600, color: 'var(--ink)' }}>
            {result ? `${peakAbsorbance.toFixed(3)} AU` : '—'}
          </span>
        </div>
        <div>
          <span style={{ color: 'var(--ink-3)', display: 'block', fontSize: 11 }}>GROUND TRUTH</span>
          <span className="mono tnum" style={{ fontWeight: 600, color: 'var(--accent)' }}>
            {scenario.groundTruth.concentration.toFixed(2)} {scenario.groundTruth.unit}
          </span>
        </div>
      </div>

      {/* QC & OOD Status */}
      {result && (
        <div style={{ display: 'flex', gap: 10, fontSize: 11.5 }}>
          <div
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: 'var(--r-sm)',
              background: result.qcStatus === 'PASS' ? 'var(--pass-quiet)' : 'var(--alert-quiet)',
              color: result.qcStatus === 'PASS' ? 'var(--pass)' : 'var(--alert)',
              fontWeight: 600,
              textAlign: 'center',
            }}
          >
            QC: {result.qcPassedChecks}/{result.qcTotalChecks} ({result.qcStatus})
          </div>
          <div
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: 'var(--r-sm)',
              background: result.oodStatus === 'IN_DISTRIBUTION' ? 'var(--pass-quiet)' : 'var(--alert-quiet)',
              color: result.oodStatus === 'IN_DISTRIBUTION' ? 'var(--pass)' : 'var(--alert)',
              fontWeight: 600,
              textAlign: 'center',
            }}
          >
            OOD: {result.oodScore.toFixed(2)} ({result.oodStatus})
          </div>
        </div>
      )}
    </div>
  );
};
