// LISA: Light-based In-field Spectral Analyser
// Application root. Owns instrument state and composes the three-column
// workspace; all scientific work happens in ./engine, untouched by this layer.

import React, { useState, useEffect } from 'react';

import { SourceMode, AnalyteDefinition, MeasurementRecord, DeviceProfile } from './types';
import { ANALYTE_REGISTRY } from './data/analytes';
import { CURATED_DEMO_SAMPLES, DemoSample } from './data/demoData';
import { DEMO_DEVICES } from './engine/deviceCalibration';
import { STANDARD_WAVELENGTHS } from './engine/spectrum';
import { simulateSpectrum, SimulationParams } from './engine/simulator';
import {
  executeLISAPipeline,
  PipelineExecutionResult,
  getOrchestratorCalibration,
} from './engine/orchestrator';
import { speakDiagnostic, stopSpeaking } from './engine/speech';

import { Header } from './components/Header';
import { PipelineVisualizer } from './components/PipelineVisualizer';
import { SpectrumViewer } from './components/SpectrumViewer';
import { AcquisitionPanel } from './components/AcquisitionPanel';
import { ResultCard } from './components/ResultCard';
import { ModelComparison } from './components/ModelComparison';
import { QCPanel } from './components/QCPanel';
import { ExplainabilityDrawer } from './components/ExplainabilityDrawer';
import { BlindTestModal } from './components/BlindTestModal';
import { AdversarialModal } from './components/AdversarialModal';
import { DeviceCalibrationModal } from './components/DeviceCalibrationModal';
import { HardwareRoadmapModal } from './components/HardwareRoadmapModal';
import { HistoryDrawer } from './components/HistoryDrawer';
import { DiagnosticsModal } from './components/DiagnosticsModal';
import { loadHistory, saveHistory } from './engine/historyStorage';
import { SampleLibraryModal } from './sampleLibrary/components/SampleLibraryModal';
import { SampleScenario } from './sampleLibrary/types';

export const App: React.FC = () => {
  // Global instrument state
  const [currentAnalyte, setCurrentAnalyte] = useState<AnalyteDefinition>(ANALYTE_REGISTRY[0]);
  const [sourceMode, setSourceMode] = useState<SourceMode>('SIMULATED');
  const [activeDevice, setActiveDevice] = useState<DeviceProfile>(DEMO_DEVICES[0]);
  const [sampleId, setSampleId] = useState<string | null>('sample-vial-y');
  const [currentSampleName, setCurrentSampleName] = useState<string>(
    'Vial Y (Spiked Agricultural Runoff)'
  );

  // Simulator parameters
  const [simParams, setSimParams] = useState<SimulationParams>({
    analyte: 'phosphate',
    concentration: 0.40,
    noiseLevel: 0.015,
    illuminationDrift: 0.0,
    shiftPx: 0,
    isSaturated: false,
    turbidityAU: 0.0,
    colorInterferenceAU: 0.0,
  });

  // Pipeline animation
  const [pipelineStageIndex, setPipelineStageIndex] = useState<number>(8);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Results & audit trail (persisted via localStorage lisa.history.v1)
  const [executionResult, setExecutionResult] = useState<PipelineExecutionResult | null>(null);
  const [history, setHistory] = useState<MeasurementRecord[]>(() => loadHistory());

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  // Overlays
  const [showSampleLibrary, setShowSampleLibrary] = useState<boolean>(false);
  const [sampleLibraryTab, setSampleLibraryTab] = useState<'library' | 'compare' | 'blind' | 'field' | 'matrix' | 'camera'>('library');
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [showBlindTest, setShowBlindTest] = useState<boolean>(false);
  const [showAdversarial, setShowAdversarial] = useState<boolean>(false);
  const [showDeviceCal, setShowDeviceCal] = useState<boolean>(false);
  const [showHardwareRoadmap, setShowHardwareRoadmap] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);

  // Voice readout
  const [isHindi, setIsHindi] = useState<boolean>(false);
  const [audioActive, setAudioActive] = useState<boolean>(false);

  // Land the instrument in a live, already-calculated state.
  useEffect(() => {
    runPipelineScan(simParams, currentSampleName, 0.40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Core pipeline execution
  const runPipelineScan = (
    params: SimulationParams,
    sampleName: string,
    groundTruth?: number,
    customSampleIntensities?: number[]
  ) => {
    // BUG-006: Never silently fall back to simulator in live camera mode
    if (sourceMode === 'LIVE CAMERA' && !customSampleIntensities) {
      console.warn('Live camera capture requires optical frame input. Refusing simulator fallback.');
      return;
    }

    setIsScanning(true);
    setPipelineStageIndex(0);

    // Staged visual progression through the 9 pipeline stages
    let stage = 0;
    const interval = setInterval(() => {
      stage++;
      setPipelineStageIndex(stage);

      if (stage >= 8) {
        clearInterval(interval);
        setIsScanning(false);

        // Generate optical data from the simulator unless raw intensities were supplied
        const simData = simulateSpectrum(params);
        const sampleIntensities = customSampleIntensities || simData.sampleIntensities;
        const blankIntensities = simData.blankIntensities;

        // Execute the central scientific pipeline with analyte and device profile
        const result = executeLISAPipeline({
          sampleName,
          sourceMode,
          analyteId: currentAnalyte.id,
          deviceId: activeDevice.id,
          deviceFingerprint: activeDevice.fingerprint,
          deviceProfile: activeDevice,
          rawSampleIntensities: sampleIntensities,
          rawBlankIntensities: blankIntensities,
          groundTruth,
          isHindi,
        });

        setExecutionResult(result);
        setHistory((prev) => [result.record, ...prev]);

        if (audioActive) {
          speakDiagnostic({
            analyteName: currentAnalyte.name,
            concentration: result.record.concentration || 0,
            uncertainty: result.record.uncertainty || 0,
            unit: currentAnalyte.unit,
            verdict: result.record.verdict,
            isHindi,
          });
        }
      }
    }, 180);
  };

  /**
   * Loads one of the curated vials, keeping the sample name, its parameters and
   * the selected preset in step with each other. Previously the name only
   * caught up at capture time, so the panel could show one vial's name over
   * another vial's parameters.
   */
  const loadSample = (sample: DemoSample) => {
    setSampleId(sample.id);
    setCurrentSampleName(sample.name);
    setSimParams({ ...sample.params });
    return sample;
  };

  const handleRunManualScan = (customIntensities?: number[], scanName?: string) => {
    if (scanName) {
      setCurrentSampleName(scanName);
      setSampleId(null);
    }
    runPipelineScan(simParams, scanName || currentSampleName, simParams.concentration, customIntensities);
  };

  const handleUploadedSpectrum = (
    wavelengths: number[],
    intensities: number[],
    name: string
  ) => {
    setSampleId(null);
    setCurrentSampleName(name);
    setSourceMode('UPLOADED');
    runPipelineScan(simParams, name, undefined, intensities);
  };

  // Guided demonstration runner
  const handleRunDemoMode = () => {
    setCurrentAnalyte(ANALYTE_REGISTRY[0]);
    setSourceMode('SIMULATED');

    const vialY = CURATED_DEMO_SAMPLES.find((s) => s.id === 'sample-vial-y')!;
    loadSample(vialY);
    runPipelineScan(vialY.params, vialY.name, vialY.groundTruthConcentration);

    setTimeout(() => setShowExplanation(true), 2400);
  };

  const handleRunBlindVial = (vial: DemoSample) => {
    loadSample(vial);
    runPipelineScan(vial.params, vial.name, vial.groundTruthConcentration);
  };

  const handleRunAdversarialSample = (sample: DemoSample) => {
    loadSample(sample);
    runPipelineScan(sample.params, sample.name, sample.groundTruthConcentration);
  };

  const handleApplyScenario = (scenario: SampleScenario) => {
    setSampleId(scenario.id);
    setCurrentSampleName(scenario.name);
    const newSimParams: SimulationParams = {
      analyte: (scenario.simulation.analyte as 'phosphate' | 'iron' | 'lead' | 'anomaly') || 'phosphate',
      concentration: scenario.simulation.concentration,
      noiseLevel: scenario.simulation.noiseLevel,
      illuminationDrift: scenario.simulation.illuminationDrift,
      shiftPx: scenario.simulation.shiftPx,
      isSaturated: scenario.simulation.isSaturated,
      turbidityAU: scenario.simulation.turbidityAU,
      colorInterferenceAU: scenario.simulation.colorInterferenceAU,
      deviceProfileId: scenario.simulation.deviceProfileId,
    };
    setSimParams(newSimParams);
    setShowSampleLibrary(false);
    runPipelineScan(newSimParams, scenario.name, scenario.groundTruth.concentration);
  };

  const handleSpeakCurrentResult = () => {
    if (!executionResult) return;
    speakDiagnostic({
      analyteName: currentAnalyte.name,
      concentration: executionResult.record.concentration || 0,
      uncertainty: executionResult.record.uncertainty || 0,
      unit: currentAnalyte.unit,
      verdict: executionResult.record.verdict,
      isHindi,
    });
  };

  // Voice readout cycles: off → English → Hindi → off
  const handleToggleAudio = () => {
    if (!audioActive) {
      setAudioActive(true);
      setIsHindi(false);
      handleSpeakCurrentResult();
    } else if (!isHindi) {
      setIsHindi(true);
      handleSpeakCurrentResult();
    } else {
      setAudioActive(false);
      setIsHindi(false);
      stopSpeaking();
    }
  };

  const hasMeasurement = executionResult !== null;

  return (
    <div className="app">
      <Header
        currentAnalyte={currentAnalyte}
        onSelectAnalyte={(analyte) => {
          setCurrentAnalyte(analyte);
          if (analyte.id === 'lead') {
            const leadSample = CURATED_DEMO_SAMPLES.find((s) => s.id === 'sample-lead-040');
            if (leadSample) {
              loadSample(leadSample);
              runPipelineScan(leadSample.params, leadSample.name, leadSample.groundTruthConcentration);
            } else {
              const newParams: SimulationParams = {
                ...simParams,
                analyte: 'lead',
                concentration: 0.40,
              };
              setSimParams(newParams);
              runPipelineScan(newParams, 'Lead Standard (0.40 mg Pb/L)', 0.40);
            }
          } else {
            const vialY = CURATED_DEMO_SAMPLES.find((s) => s.id === 'sample-vial-y');
            if (vialY) {
              loadSample(vialY);
              runPipelineScan(vialY.params, vialY.name, vialY.groundTruthConcentration);
            } else {
              const newParams: SimulationParams = {
                ...simParams,
                analyte: (analyte.id as any) || 'phosphate',
                concentration: 0.40,
              };
              setSimParams(newParams);
              runPipelineScan(newParams, 'Standard Scan', 0.40);
            }
          }
        }}
        onTriggerDemo={handleRunDemoMode}
        onOpenSampleLibrary={() => {
          setSampleLibraryTab('library');
          setShowSampleLibrary(true);
        }}
        onOpenBlindTest={() => setShowBlindTest(true)}
        onOpenAdversarial={() => setShowAdversarial(true)}
        onOpenDeviceCal={() => setShowDeviceCal(true)}
        onOpenHardwareRoadmap={() => setShowHardwareRoadmap(true)}
        onOpenHistory={() => setShowHistory(true)}
        onOpenDiagnostics={() => setShowDiagnostics(true)}
        isHindi={isHindi}
        onToggleHindi={handleToggleAudio}
        audioActive={audioActive}
        historyCount={history.length}
        onMeasure={handleRunManualScan}
        isScanning={isScanning}
      />

      <PipelineVisualizer
        currentStageIndex={pipelineStageIndex}
        isProcessing={isScanning}
        onSelectStage={() => setShowExplanation(true)}
      />

      <main className="workspace">
        <section className="workspace__col workspace__col--acq">
          <AcquisitionPanel
            sourceMode={sourceMode}
            onSelectSourceMode={setSourceMode}
            currentAnalyte={currentAnalyte}
            simParams={simParams}
            onChangeSimParams={setSimParams}
            onSelectSample={(id) => {
              const sample = CURATED_DEMO_SAMPLES.find((s) => s.id === id);
              if (sample) loadSample(sample);
            }}
            sampleId={sampleId}
            onRunScan={handleRunManualScan}
            isScanning={isScanning}
            hasMeasurement={hasMeasurement}
            onUploadSpectrumData={handleUploadedSpectrum}
          />
        </section>

        <section className="workspace__col workspace__col--plot">
          <SpectrumViewer
            wavelengths={executionResult?.record.wavelengths || STANDARD_WAVELENGTHS}
            absorbances={executionResult?.absorbances || new Array(151).fill(0)}
            rawIntensities={executionResult?.alignedProfile}
            blankIntensities={getOrchestratorCalibration(currentAnalyte.id === 'lead' ? 'lead' : 'phosphate').calibrationStandards[0]?.blankIntensities}
            bandStartNm={currentAnalyte.primaryBand[0]}
            bandEndNm={currentAnalyte.primaryBand[1]}
            peakNm={currentAnalyte.peakWavelength}
            sampleName={currentSampleName}
            isRejected={executionResult?.record.isRejected}
            hasMeasurement={hasMeasurement}
            isScanning={isScanning}
          />

          {executionResult && (
            <ModelComparison
              beerMetrics={executionResult.beerMetrics}
              ridgeMetrics={executionResult.ridgeMetrics}
              selectedModel={executionResult.record.selectedModel}
            />
          )}
        </section>

        <section className="workspace__col workspace__col--result">
          <ResultCard
            record={executionResult?.record || null}
            currentAnalyte={currentAnalyte}
            onOpenExplanation={() => setShowExplanation(true)}
            onSpeakResult={handleSpeakCurrentResult}
            isScanning={isScanning}
          />

          <QCPanel qc={executionResult?.qc || null} ood={executionResult?.ood || null} />
        </section>
      </main>

      <ExplainabilityDrawer
        isOpen={showExplanation}
        onClose={() => setShowExplanation(false)}
        explanation={executionResult?.record.explanation || null}
        onSpeakHindi={() => {
          setIsHindi(true);
          handleSpeakCurrentResult();
        }}
      />

      <SampleLibraryModal
        isOpen={showSampleLibrary}
        onClose={() => setShowSampleLibrary(false)}
        onApplyScenarioToMainApp={handleApplyScenario}
        onRecordAdded={(rec) => setHistory((prev) => [rec, ...prev])}
        initialTab={sampleLibraryTab}
      />

      <BlindTestModal
        isOpen={showBlindTest}
        onClose={() => setShowBlindTest(false)}
        onSelectVialAndRun={handleRunBlindVial}
        activeMeasurementConc={executionResult?.record.concentration ?? null}
        activeMeasurementUncertainty={executionResult?.record.uncertainty ?? null}
      />

      <AdversarialModal
        isOpen={showAdversarial}
        onClose={() => setShowAdversarial(false)}
        onSelectAdversarialSample={handleRunAdversarialSample}
      />

      <DeviceCalibrationModal
        isOpen={showDeviceCal}
        onClose={() => setShowDeviceCal(false)}
        activeDevice={activeDevice}
        onSelectDevice={setActiveDevice}
      />

      <HardwareRoadmapModal
        isOpen={showHardwareRoadmap}
        onClose={() => setShowHardwareRoadmap(false)}
      />

      <HistoryDrawer
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        records={history}
        onSelectRecord={(r) => {
          // Restore a historical record as the active result
          const cal = getOrchestratorCalibration();
          setExecutionResult({
            record: r,
            alignedProfile: r.rawIntensities,
            absorbances: r.absorbances,
            baselineProfile: new Array(151).fill(0),
            shiftPx: 0,
            qc: {
              overallStatus: r.qcStatus,
              saturationCheck: { id: 'sat', name: 'Pixel Saturation', status: 'PASS', value: '210/255', threshold: '<245', detail: 'OK' },
              signalStrengthCheck: { id: 'sig', name: 'Signal Throughput', status: 'PASS', value: '210 AU', threshold: '>40', detail: 'OK' },
              spectralShiftCheck: { id: 'shf', name: 'Optical Alignment', status: 'PASS', value: '0 px', threshold: '±6px', detail: 'OK' },
              calibrationRangeCheck: { id: 'rng', name: 'Dynamic Range', status: 'PASS', value: `${r.concentration} mg/L`, threshold: '0-1 mg/L', detail: 'OK' },
              turbidityInterferenceCheck: { id: 'trb', name: 'Matrix Turbidity', status: 'PASS', value: '0.02 AU', threshold: '<0.12', detail: 'OK' },
              canProceed: !r.isRejected,
            },
            ood: {
              score: 0.95,
              status: r.oodStatus,
              isAnomaly: r.isRejected,
              nearestStandardConc: r.concentration || 0.4,
              detail: 'Historical record restored from local audit log.',
            },
            beerMetrics: cal.beerLambertFit ? {
              name: 'Beer-Lambert',
              type: 'beer-lambert',
              r2: cal.beerLambertFit.r2,
              rmse: cal.beerLambertFit.rmse,
              loocvRmse: cal.beerLambertFit.loocvRmse,
            } : { name: 'Beer-Lambert', type: 'beer-lambert', r2: 0.98, rmse: 0.04, loocvRmse: 0.04 },
            ridgeMetrics: {
              name: 'Ridge (151 Bands)',
              type: 'ridge',
              r2: cal.ridgeModel.r2,
              rmse: cal.ridgeModel.rmse,
              loocvRmse: cal.ridgeModel.loocvRmse,
            },
            executionTimeMs: 14.2,
          });
        }}
        onClearHistory={() => setHistory([])}
      />

      <DiagnosticsModal
        isOpen={showDiagnostics}
        onClose={() => setShowDiagnostics(false)}
        lastExecutionMs={executionResult?.executionTimeMs || 0}
      />
    </div>
  );
};

export default App;
