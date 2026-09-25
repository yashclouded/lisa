// LISA: Sample acquisition
// The default surface shows only what a field operator needs: which sample is
// loaded, where the signal comes from, and one button. Simulator engineering
// parameters live behind "Advanced simulation controls".

import React, { useRef, useState } from 'react';
import {
  Upload,
  Camera,
  Cpu,
  RefreshCw,
  AlertTriangle,
  FlaskConical,
  Check,
} from 'lucide-react';
import { SourceMode, AnalyteDefinition } from '../types';
import { SimulationParams } from '../engine/simulator';
import { CURATED_DEMO_SAMPLES } from '../data/demoData';
import { parseSpectralCSV } from '../adapters/csvAdapter';
import { detectSpectralROI, extractProfileFromROI, ROIBox } from '../adapters/imageRoi';
import { CameraAdapter } from '../adapters/camera';
import { Segmented } from './ui/Segmented';
import { Disclosure } from './ui/Disclosure';

interface AcquisitionPanelProps {
  sourceMode: SourceMode;
  onSelectSourceMode: (mode: SourceMode) => void;
  currentAnalyte: AnalyteDefinition;
  simParams: SimulationParams;
  onChangeSimParams: (params: SimulationParams) => void;
  onSelectSample: (sampleId: string) => void;
  sampleId: string | null;
  onRunScan: (overrideIntensities?: number[], scanName?: string) => void;
  isScanning: boolean;
  hasMeasurement: boolean;
  onUploadSpectrumData: (wavelengths: number[], intensities: number[], name: string) => void;
}

export const AcquisitionPanel: React.FC<AcquisitionPanelProps> = ({
  sourceMode,
  onSelectSourceMode,
  currentAnalyte,
  simParams,
  onChangeSimParams,
  onSelectSample,
  sampleId,
  onRunScan,
  isScanning,
  hasMeasurement,
  onUploadSpectrumData,
}) => {
  const [csvText, setCsvText] = useState('');
  const [csvError, setCsvError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [detectedRoi, setDetectedRoi] = useState<ROIBox | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraAdapterRef = useRef<CameraAdapter | null>(null);

  const activeSample = CURATED_DEMO_SAMPLES.find((s) => s.id === sampleId) ?? null;

  const handleParseCSV = () => {
    if (!csvText.trim()) return;
    const res = parseSpectralCSV(csvText);
    if (res.success) {
      setCsvError(null);
      onUploadSpectrumData(
        res.wavelengths,
        res.intensities.length > 0 ? res.intensities : res.absorbances || [],
        'Uploaded CSV'
      );
    } else {
      setCsvError(res.error || 'Could not read that CSV.');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const roi = detectSpectralROI(ctx, img.width, img.height);
        setDetectedRoi(roi);

        ctx.strokeStyle = '#0b6e7f';
        ctx.lineWidth = 3;
        ctx.strokeRect(roi.x, roi.y, roi.width, roi.height);

        const extracted = extractProfileFromROI(ctx, roi, 151);
        setImageLoaded(true);
        onUploadSpectrumData([], extracted.profile, file.name);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleToggleCamera = async () => {
    if (!cameraActive) {
      if (!cameraAdapterRef.current) cameraAdapterRef.current = new CameraAdapter();
      try {
        if (videoRef.current) {
          await cameraAdapterRef.current.startCamera(videoRef.current);
          setCameraActive(true);
          setCameraError(null);
        }
      } catch (err) {
        setCameraError(err instanceof Error ? err.message : 'Camera could not be started.');
      }
    } else {
      cameraAdapterRef.current?.stopCamera();
      setCameraActive(false);
    }
  };

  return (
    <div className="card">
      <div className="card__head">
        <span className="card__title">Sample</span>
      </div>

      <div className="card__body">
        {/* Current sample — read this first */}
        <div
          style={{
            background: 'var(--surface-sunken)',
            borderRadius: 'var(--r-md)',
            padding: '13px 15px',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          <span
            style={{
              fontSize: 14.5,
              fontWeight: 550,
              color: 'var(--ink)',
              letterSpacing: '-0.01em',
            }}
          >
            {activeSample ? activeSample.name : hasMeasurement ? 'Captured sample' : 'No sample loaded'}
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.45 }}>
            {activeSample
              ? activeSample.description
              : 'Select a curated sample below, or upload your own spectrum.'}
          </span>
          <span
            className="mono"
            style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 5 }}
          >
            {simParams.concentration.toFixed(currentAnalyte.id === 'lead' ? 3 : 2)} {currentAnalyte.unit} simulated
          </span>
        </div>

        {/* Signal source */}
        <div className="field">
          <span className="field__label">Signal source</span>
          <Segmented<SourceMode>
            label="Signal source"
            block
            value={sourceMode}
            onChange={onSelectSourceMode}
            options={[
              { value: 'SIMULATED', label: 'Simulator' },
              { value: 'UPLOADED', label: 'Upload' },
              { value: 'LIVE CAMERA', label: 'Camera' },
              { value: 'HARDWARE', label: 'Hardware' },
            ]}
          />
        </div>

        {/* ---- Simulator ---- */}
        {sourceMode === 'SIMULATED' && (
          <>
            <div className="field">
              <label className="field__label" htmlFor="sample-preset">
                <span>Curated sample</span>
              </label>
              <select
                id="sample-preset"
                className="select select--block"
                value={sampleId ?? ''}
                onChange={(e) => onSelectSample(e.target.value)}
              >
                {sampleId === null && <option value="">Custom / uploaded</option>}
                {CURATED_DEMO_SAMPLES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <div className="field__label">
                <label htmlFor="conc-slider">Concentration</label>
                <span className="field__value mono">
                  {simParams.concentration.toFixed(currentAnalyte.id === 'lead' ? 3 : 2)} {currentAnalyte.unit}
                </span>
              </div>
              <input
                id="conc-slider"
                type="range"
                min={currentAnalyte.calibrationRange[0].toFixed(2)}
                max={(currentAnalyte.calibrationRange[1] * (currentAnalyte.id === 'lead' ? 1.0 : 1.2)).toFixed(2)}
                step={currentAnalyte.id === 'lead' ? '0.005' : '0.01'}
                className="slider"
                value={simParams.concentration}
                onChange={(e) =>
                  onChangeSimParams({ ...simParams, concentration: parseFloat(e.target.value) })
                }
              />
              <div className="slider-scale">
                <span>{currentAnalyte.calibrationRange[0].toFixed(2)}</span>
                <span>{currentAnalyte.safeThreshold.toFixed(2)} safe</span>
                <span>{currentAnalyte.alertThreshold.toFixed(2)} alert</span>
                <span>{(currentAnalyte.calibrationRange[1] * (currentAnalyte.id === 'lead' ? 1.0 : 1.2)).toFixed(2)}</span>
              </div>
            </div>

            <Disclosure label="Advanced simulation controls">
              <div className="stack" style={{ gap: 16 }}>
                <div className="field">
                  <div className="field__label">
                    <label htmlFor="noise-slider">Sensor noise</label>
                    <span className="field__value mono">
                      {(simParams.noiseLevel * 100).toFixed(1)}%
                    </span>
                  </div>
                  <input
                    id="noise-slider"
                    type="range"
                    min="0.00"
                    max="0.10"
                    step="0.005"
                    className="slider"
                    value={simParams.noiseLevel}
                    onChange={(e) =>
                      onChangeSimParams({ ...simParams, noiseLevel: parseFloat(e.target.value) })
                    }
                  />
                </div>

                <div className="field">
                  <div className="field__label">
                    <label htmlFor="shift-slider">Cuvette shift</label>
                    <span className="field__value mono">
                      {simParams.shiftPx > 0 ? '+' : ''}
                      {simParams.shiftPx} px
                    </span>
                  </div>
                  <input
                    id="shift-slider"
                    type="range"
                    min="-10"
                    max="10"
                    step="1"
                    className="slider"
                    value={simParams.shiftPx}
                    onChange={(e) =>
                      onChangeSimParams({ ...simParams, shiftPx: parseInt(e.target.value, 10) })
                    }
                  />
                </div>

                <div className="field">
                  <div className="field__label">
                    <label htmlFor="turbidity-slider">Colloidal turbidity</label>
                    <span className="field__value mono">
                      {simParams.turbidityAU.toFixed(2)} AU
                    </span>
                  </div>
                  <input
                    id="turbidity-slider"
                    type="range"
                    min="0.00"
                    max="0.60"
                    step="0.02"
                    className="slider"
                    value={simParams.turbidityAU}
                    onChange={(e) =>
                      onChangeSimParams({ ...simParams, turbidityAU: parseFloat(e.target.value) })
                    }
                  />
                </div>

                <label className="switch">
                  <input
                    type="checkbox"
                    checked={simParams.isSaturated}
                    onChange={(e) =>
                      onChangeSimParams({ ...simParams, isSaturated: e.target.checked })
                    }
                  />
                  <span className="switch__track" aria-hidden="true" />
                  <span>Simulate pixel saturation</span>
                </label>
              </div>
            </Disclosure>
          </>
        )}

        {/* ---- Upload ---- */}
        {sourceMode === 'UPLOADED' && (
          <>
            <div className="field">
              <label className="field__label" htmlFor="csv-input">
                <span>Paste spectrum data</span>
                <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>wavelength, intensity</span>
              </label>
              <textarea
                id="csv-input"
                className="textarea"
                rows={5}
                placeholder={'400,120.4\n402,122.1\n404,124.8\n…\n700,110.2'}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
              />
            </div>

            {csvError && (
              <div className="callout callout--alert">
                <span className="callout__icon" aria-hidden="true">
                  <AlertTriangle size={16} />
                </span>
                <span>{csvError}</span>
              </div>
            )}

            <button type="button" className="btn btn--secondary btn--block" onClick={handleParseCSV}>
              <Upload size={15} aria-hidden="true" />
              <span>Load spectrum</span>
            </button>

            <div className="rule" />

            <div className="field">
              <label className="field__label" htmlFor="image-input">
                <span>Or read a spectrum photograph</span>
              </label>
              <input
                id="image-input"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ fontSize: 12.5, color: 'var(--ink-2)' }}
              />
              <canvas
                ref={canvasRef}
                style={{
                  width: '100%',
                  maxHeight: 120,
                  borderRadius: 8,
                  display: imageLoaded ? 'block' : 'none',
                  background: '#000',
                }}
              />
              {detectedRoi && (
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--pass)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <Check size={13} aria-hidden="true" />
                  Band detected · {detectedRoi.width}×{detectedRoi.height} px
                </span>
              )}
            </div>
          </>
        )}

        {/* ---- Camera ---- */}
        {sourceMode === 'LIVE CAMERA' && (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              style={{
                width: '100%',
                maxHeight: 190,
                borderRadius: 'var(--r-md)',
                background: '#000',
                display: cameraActive ? 'block' : 'none',
              }}
            />

            {!cameraActive && (
              <div className="empty" style={{ padding: '26px 16px' }}>
                <Camera className="empty__icon" size={22} aria-hidden="true" />
                <span className="empty__text">
                  Point the rear camera through the diffraction grating clip.
                </span>
              </div>
            )}

            {cameraError && (
              <div className="callout callout--alert">
                <span className="callout__icon" aria-hidden="true">
                  <AlertTriangle size={16} />
                </span>
                <span>{cameraError}</span>
              </div>
            )}

            <button
              type="button"
              className={`btn btn--block ${cameraActive ? 'btn--danger' : 'btn--secondary'}`}
              onClick={handleToggleCamera}
            >
              <Camera size={15} aria-hidden="true" />
              <span>{cameraActive ? 'Stop camera' : 'Start camera'}</span>
            </button>
          </>
        )}

        {/* ---- Hardware ---- */}
        {sourceMode === 'HARDWARE' && (
          <div className="callout callout--neutral" style={{ flexDirection: 'column', gap: 7 }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: 'var(--ink)',
                fontWeight: 550,
              }}
            >
              <Cpu size={16} aria-hidden="true" />
              LISA-HW-001-PROTO
            </span>
            <span style={{ fontSize: 12.5 }}>
              USB / BLE optical spectrometer head. Connected — battery 92%, LED on, 30 fps.
            </span>
            <span style={{ fontSize: 12.5 }}>
              The hardware interface is pluggable; the production Foldscope clip populates the same
              raw photodiode buffers as the simulator.
            </span>
          </div>
        )}

        {/* Single dominant action */}
        <button
          type="button"
          className={`btn btn--block ${hasMeasurement ? 'btn--secondary' : 'btn--primary btn--lg'}`}
          onClick={() => {
            if (sourceMode === 'LIVE CAMERA') {
              if (!cameraActive || !cameraAdapterRef.current?.isRunning()) {
                setCameraError('Camera is not active. Please click "Start camera" before capturing.');
                return;
              }
              try {
                const extracted = cameraAdapterRef.current.captureFrame(canvasRef.current);
                setDetectedRoi(extracted.roi);
                setImageLoaded(true);
                setCameraError(null);
                onRunScan(extracted.profile, 'Live Camera Capture');
              } catch (err) {
                setCameraError(err instanceof Error ? err.message : 'Camera frame capture failed.');
              }
              return;
            }
            onRunScan();
          }}
          disabled={isScanning}
          style={{ marginTop: 4 }}
        >
          {isScanning ? (
            <>
              <RefreshCw className="btn__icon" size={16} aria-hidden="true" />
              <span>Analysing…</span>
            </>
          ) : (
            <>
              <FlaskConical className="btn__icon" size={16} aria-hidden="true" />
              <span>{hasMeasurement ? 'Capture again' : 'Capture & analyse'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
