// LISA: Instrument header
// Deliberately minimal — identity, analyte, and the one primary action.
// Every secondary capability lives in the overflow menu rather than competing
// for attention in the toolbar.

import React from 'react';
import {
  Play,
  Eye,
  ShieldAlert,
  Smartphone,
  Cpu,
  Terminal,
  Volume2,
  VolumeX,
  History as HistoryIcon,
  Box,
  FolderOpen,
} from 'lucide-react';
import { AnalyteDefinition } from '../types';
import { ANALYTE_REGISTRY } from '../data/analytes';
import { Menu, MenuItem } from './ui/Menu';

interface HeaderProps {
  currentAnalyte: AnalyteDefinition;
  onSelectAnalyte: (analyte: AnalyteDefinition) => void;
  onTriggerDemo: () => void;
  onOpenSampleLibrary?: () => void;
  onOpenBlindTest: () => void;
  onOpenAdversarial: () => void;
  onOpenDeviceCal: () => void;
  onOpenHardwareRoadmap: () => void;
  onOpenHistory: () => void;
  onOpenDiagnostics: () => void;
  isHindi: boolean;
  onToggleHindi: () => void;
  audioActive: boolean;
  historyCount: number;
  onMeasure: () => void;
  isScanning: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentAnalyte,
  onSelectAnalyte,
  onTriggerDemo,
  onOpenSampleLibrary,
  onOpenBlindTest,
  onOpenAdversarial,
  onOpenDeviceCal,
  onOpenHardwareRoadmap,
  onOpenHistory,
  onOpenDiagnostics,
  isHindi,
  onToggleHindi,
  audioActive,
  historyCount,
  onMeasure,
  isScanning,
}) => {
  const menuGroups: MenuItem[][] = [
    [
      {
        id: 'library',
        label: 'Sample library & field lab',
        hint: '14 scenarios',
        icon: <FolderOpen size={15} />,
        onSelect: onOpenSampleLibrary ?? onTriggerDemo,
      },
      {
        id: 'demo',
        label: 'Run guided demo',
        hint: '2 min',
        icon: <Play size={15} />,
        onSelect: onTriggerDemo,
      },
      {
        id: 'blind',
        label: 'Blind sample test',
        icon: <Eye size={15} />,
        onSelect: onOpenBlindTest,
      },
      {
        id: 'adversarial',
        label: 'Adversarial samples',
        icon: <ShieldAlert size={15} />,
        onSelect: onOpenAdversarial,
      },
    ],
    [
      {
        id: 'calibrate',
        label: 'Calibrate device',
        icon: <Smartphone size={15} />,
        onSelect: onOpenDeviceCal,
      },
      {
        id: 'hardware',
        label: 'Hardware design',
        icon: <Cpu size={15} />,
        onSelect: onOpenHardwareRoadmap,
      },
      {
        id: 'voice',
        label: audioActive ? `Voice readout: ${isHindi ? 'हिंदी' : 'English'}` : 'Voice readout',
        icon: audioActive ? <Volume2 size={15} /> : <VolumeX size={15} />,
        onSelect: onToggleHindi,
      },
    ],
    [
      {
        id: 'diagnostics',
        label: 'Diagnostics & provenance',
        icon: <Terminal size={15} />,
        onSelect: onOpenDiagnostics,
      },
    ],
  ];

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="brand">
          <span className="brand__mark">LISA</span>
          <span className="brand__rule" aria-hidden="true" />
          <span className="brand__sub">Light-based In-field Spectral Analyser</span>
        </div>

        <div className="app-header__spacer" />

        <div className="app-header__analyte">
          <label className="sr-only" htmlFor="analyte-select">
            Analyte under measurement
          </label>
          <select
            id="analyte-select"
            className="select"
            value={currentAnalyte.id}
            onChange={(e) => {
              const found = ANALYTE_REGISTRY.find((a) => a.id === e.target.value);
              if (found) onSelectAnalyte(found);
            }}
          >
            {ANALYTE_REGISTRY.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.status !== 'live' ? ` — ${a.status}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="app-header__actions">
          <a className="btn btn--feature" href="#/twin">
            <Box className="btn__icon" size={15} aria-hidden="true" />
            <span>Digital twin</span>
            <span className="btn__tag">3D</span>
          </a>

          {onOpenSampleLibrary && (
            <button
              type="button"
              className="btn btn--secondary"
              onClick={onOpenSampleLibrary}
            >
              <FolderOpen className="btn__icon" size={15} aria-hidden="true" />
              <span>Sample library</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn--primary"
            onClick={onMeasure}
            disabled={isScanning}
          >
            {isScanning ? 'Analysing…' : 'Measure'}
          </button>

          <button type="button" className="btn btn--secondary" onClick={onOpenHistory}>
            <HistoryIcon className="btn__icon" size={15} aria-hidden="true" />
            <span>History</span>
            {historyCount > 0 && (
              <span style={{ color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>
                {historyCount}
              </span>
            )}
          </button>

          <Menu label="More instrument actions" groups={menuGroups} />
        </div>
      </div>
    </header>
  );
};
