// LISA: Sample Library Card Component
// Communicates Source, Mode, Ground Truth (or Unknown), and Provenance.
// Visually reinforces: Water Photo != Phosphate Measurement.

import React from 'react';
import { SampleScenario } from '../types';
import { Play, Eye } from 'lucide-react';

interface SampleCardProps {
  scenario: SampleScenario;
  isSelected?: boolean;
  onSelect: (scenario: SampleScenario) => void;
  onRunDirectly?: (scenario: SampleScenario) => void;
}

export const SampleCard: React.FC<SampleCardProps> = ({
  scenario,
  isSelected,
  onSelect,
  onRunDirectly,
}) => {
  const isAnomaly = scenario.category === 'adversarial' || scenario.category === 'hardware_fault';

  return (
    <div
      className={`card ${isSelected ? 'card--active' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        background: isSelected ? 'var(--surface-sunken)' : 'var(--surface-raised)',
        border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        transition: 'border-color var(--dur-fast), transform var(--dur-fast)',
        cursor: 'pointer',
      }}
      onClick={() => onSelect(scenario)}
    >
      {/* Visual illustration with scientific context watermark */}
      <div
        style={{
          position: 'relative',
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
        {scenario.sourceVisual.svgDataUri ? (
          <img
            src={scenario.sourceVisual.svgDataUri}
            alt={scenario.sourceVisual.title}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            loading="lazy"
          />
        ) : (
          <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>Context visual</div>
        )}

        {/* Provenance Badge */}
        <span
          className="badge"
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(22, 24, 29, 0.85)',
            color: '#ffffff',
            fontSize: 10,
            letterSpacing: '0.04em',
            backdropFilter: 'blur(4px)',
          }}
        >
          {scenario.provenance}
        </span>

        {/* Category tag */}
        <span
          className="badge"
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            background: 'rgba(255, 255, 255, 0.9)',
            color: 'var(--ink)',
            fontSize: 10.5,
            border: '1px solid var(--line)',
          }}
        >
          {scenario.sourceType}
        </span>
      </div>

      {/* Header & Description */}
      <div>
        <h4
          style={{
            margin: '0 0 4px',
            fontSize: 14.5,
            fontWeight: 600,
            color: 'var(--ink)',
            lineHeight: 1.25,
          }}
        >
          {scenario.name}
        </h4>
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            color: 'var(--ink-2)',
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {scenario.description}
        </p>
      </div>

      {/* Optical measurement metadata panel */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 6,
          background: 'var(--surface-page)',
          padding: '8px 10px',
          borderRadius: 'var(--r-sm)',
          fontSize: 11.5,
          border: '1px solid var(--line)',
        }}
      >
        <div>
          <span style={{ color: 'var(--ink-3)', display: 'block', fontSize: 10.5 }}>MODE</span>
          <span style={{ fontWeight: 500, color: 'var(--ink)' }}>Simulated optics</span>
        </div>
        <div>
          <span style={{ color: 'var(--ink-3)', display: 'block', fontSize: 10.5 }}>GROUND TRUTH</span>
          <span
            className="tnum"
            style={{
              fontWeight: 600,
              color: isAnomaly ? 'var(--alert)' : 'var(--accent)',
            }}
          >
            {isAnomaly
              ? 'Unknown / Anomaly'
              : `${scenario.groundTruth.concentration.toFixed(2)} ${scenario.groundTruth.unit}`}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
        <button
          type="button"
          className="btn btn--secondary"
          style={{ flex: 1, padding: '6px 10px', fontSize: 12 }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(scenario);
          }}
        >
          <Eye size={13} aria-hidden="true" />
          <span>Inspect</span>
        </button>

        {onRunDirectly && (
          <button
            type="button"
            className="btn btn--primary"
            style={{ flex: 1, padding: '6px 10px', fontSize: 12 }}
            onClick={(e) => {
              e.stopPropagation();
              onRunDirectly(scenario);
            }}
          >
            <Play size={13} aria-hidden="true" />
            <span>Run LISA</span>
          </button>
        )}
      </div>
    </div>
  );
};
