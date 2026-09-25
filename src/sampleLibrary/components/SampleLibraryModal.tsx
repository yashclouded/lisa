// LISA: Sample Library & Field Simulation Lab Master Overlay
// Unified interactive laboratory modal hosting:
// 1. Curated Sample Library & Detailed Signal Flow
// 2. Side-by-Side Sample Comparison View
// 3. Blind Sample Test Protocol
// 4. Today's Water Route (Field Day Mode)
// 5. Virtual Field Stress Matrix & Batch Simulation
// 6. 2D CMOS Dispersion Frame & ROI Diagnostic

import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { SampleScenario } from '../types';
import { SAMPLE_SCENARIOS } from '../scenarios';
import { SampleCard } from './SampleCard';
import { SampleDetailView } from './SampleDetailView';
import { SampleComparisonView } from './SampleComparisonView';
import { BlindTestView } from './BlindTestView';
import { FieldDayView } from './FieldDayView';
import { StressMatrixView } from './StressMatrixView';
import { ImageDiagnosticView } from './ImageDiagnosticView';
import {
  FolderOpen,
  GitCompare,
  Eye,
  MapPin,
  Layers,
  Camera,
  Search,
} from 'lucide-react';
import { MeasurementRecord } from '../../types';

interface SampleLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyScenarioToMainApp?: (scenario: SampleScenario) => void;
  onRecordAdded?: (record: MeasurementRecord) => void;
  initialTab?: 'library' | 'compare' | 'blind' | 'field' | 'matrix' | 'camera';
}

export const SampleLibraryModal: React.FC<SampleLibraryModalProps> = ({
  isOpen,
  onClose,
  onApplyScenarioToMainApp,
  onRecordAdded,
  initialTab = 'library',
}) => {
  const [activeTab, setActiveTab] = useState<'library' | 'compare' | 'blind' | 'field' | 'matrix' | 'camera'>(initialTab);
  const [inspectedScenario, setInspectedScenario] = useState<SampleScenario | null>(null);

  // Search & Filter in Library
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredScenarios = SAMPLE_SCENARIOS.filter((sc) => {
    const matchesSearch =
      sc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sc.sourceType.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'all'
        ? true
        : selectedCategory === 'drinking'
        ? sc.category === 'drinking'
        : selectedCategory === 'surface'
        ? sc.category === 'surface'
        : selectedCategory === 'agricultural'
        ? sc.category === 'agricultural'
        : selectedCategory === 'anomalies'
        ? sc.category === 'adversarial' || sc.category === 'hardware_fault'
        : true;

    return matchesSearch && matchesCategory;
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="LISA Sample Library & Field Simulation Lab"
      subtitle="Comprehensive environmental water scenarios, physical dispersion models, blind testing, and validation suites."
      size="wide"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Navigation Tabs Bar */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            borderBottom: '1px solid var(--line)',
            paddingBottom: 8,
            overflowX: 'auto',
          }}
        >
          <TabButton
            active={activeTab === 'library'}
            onClick={() => {
              setActiveTab('library');
              setInspectedScenario(null);
            }}
            icon={<FolderOpen size={14} />}
            label="Sample Library"
            count={SAMPLE_SCENARIOS.length}
          />
          <TabButton
            active={activeTab === 'compare'}
            onClick={() => setActiveTab('compare')}
            icon={<GitCompare size={14} />}
            label="Sample Compare"
          />
          <TabButton
            active={activeTab === 'blind'}
            onClick={() => setActiveTab('blind')}
            icon={<Eye size={14} />}
            label="Blind Test Lab"
          />
          <TabButton
            active={activeTab === 'field'}
            onClick={() => setActiveTab('field')}
            icon={<MapPin size={14} />}
            label="Field Day Route"
          />
          <TabButton
            active={activeTab === 'matrix'}
            onClick={() => setActiveTab('matrix')}
            icon={<Layers size={14} />}
            label="Stress Matrix & Batch"
          />
          <TabButton
            active={activeTab === 'camera'}
            onClick={() => setActiveTab('camera')}
            icon={<Camera size={14} />}
            label="Image & CV Diagnostics"
          />
        </div>

        {/* Tab 1: Sample Library */}
        {activeTab === 'library' && (
          <div>
            {inspectedScenario ? (
              <SampleDetailView
                scenario={inspectedScenario}
                onBack={() => setInspectedScenario(null)}
                onApplyToMainApp={onApplyScenarioToMainApp}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Search & Category Filter */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 14,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
                    <Search
                      size={14}
                      color="var(--ink-3)"
                      style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
                    />
                    <input
                      type="text"
                      className="input"
                      placeholder="Search water scenarios, sources, contaminants…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ paddingLeft: 34, width: '100%' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <CategoryPill active={selectedCategory === 'all'} onClick={() => setSelectedCategory('all')} label="All" />
                    <CategoryPill active={selectedCategory === 'drinking'} onClick={() => setSelectedCategory('drinking')} label="Drinking Water" />
                    <CategoryPill active={selectedCategory === 'surface'} onClick={() => setSelectedCategory('surface')} label="Surface Water" />
                    <CategoryPill active={selectedCategory === 'agricultural'} onClick={() => setSelectedCategory('agricultural')} label="Agricultural" />
                    <CategoryPill active={selectedCategory === 'anomalies'} onClick={() => setSelectedCategory('anomalies')} label="Anomalies & Faults" />
                  </div>
                </div>

                {/* Scenario Cards Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
                    gap: 16,
                  }}
                >
                  {filteredScenarios.map((sc) => (
                    <SampleCard
                      key={sc.id}
                      scenario={sc}
                      onSelect={(s) => setInspectedScenario(s)}
                      onRunDirectly={(s) => {
                        setInspectedScenario(s);
                      }}
                    />
                  ))}
                </div>

                {filteredScenarios.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-3)' }}>
                    No water scenarios matched your search filter.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Sample Comparison */}
        {activeTab === 'compare' && <SampleComparisonView />}

        {/* Tab 3: Blind Test Lab */}
        {activeTab === 'blind' && <BlindTestView />}

        {/* Tab 4: Field Day Route */}
        {activeTab === 'field' && <FieldDayView onRecordAdded={onRecordAdded} />}

        {/* Tab 5: Stress Matrix & Batch */}
        {activeTab === 'matrix' && <StressMatrixView />}

        {/* Tab 6: Image & CV Diagnostics */}
        {activeTab === 'camera' && <ImageDiagnosticView />}
      </div>
    </Modal>
  );
};

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}> = ({ active, onClick, icon, label, count }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '8px 14px',
      borderRadius: 'var(--r-sm)',
      border: 'none',
      background: active ? 'var(--surface-sunken)' : 'transparent',
      color: active ? 'var(--accent)' : 'var(--ink-2)',
      fontWeight: active ? 600 : 500,
      fontSize: 13,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      transition: 'background var(--dur-fast), color var(--dur-fast)',
    }}
  >
    {icon}
    <span>{label}</span>
    {count !== undefined && (
      <span
        style={{
          background: active ? 'var(--accent)' : 'var(--line)',
          color: active ? '#ffffff' : 'var(--ink-3)',
          fontSize: 10.5,
          fontWeight: 600,
          padding: '1px 6px',
          borderRadius: 999,
        }}
      >
        {count}
      </span>
    )}
  </button>
);

const CategoryPill: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
}> = ({ active, onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      padding: '4px 10px',
      borderRadius: 999,
      fontSize: 11.5,
      fontWeight: 500,
      border: active ? '1px solid var(--accent)' : '1px solid var(--line)',
      background: active ? 'var(--accent-quiet)' : 'transparent',
      color: active ? 'var(--accent)' : 'var(--ink-2)',
      cursor: 'pointer',
    }}
  >
    {label}
  </button>
);
