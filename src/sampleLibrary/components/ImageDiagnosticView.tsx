// LISA: Image & Computer Vision Diagnostic View
// Interactive inspection of 2D camera sensor frames representing diffraction grating captures.
// Visualizes automatic ROI detection, variance centroid, spectral profile extraction,
// and image perturbation robustness.

import React, { useState, useEffect, useRef } from 'react';
import { IMAGE_FIXTURES, ImageFixture, evaluateImageFixture } from '../imageFixtures';
import { runAugmentationStressTest, AugmentationResult } from '../imageAugmentations';
import { CheckCircle2, AlertTriangle, Play } from 'lucide-react';

export const ImageDiagnosticView: React.FC = () => {
  const [selectedFixture, setSelectedFixture] = useState<ImageFixture>(IMAGE_FIXTURES[0]);
  const fixtureResult = evaluateImageFixture(selectedFixture);

  // Augmentation testing state
  const [augResults, setAugResults] = useState<AugmentationResult[] | null>(null);
  const [isAugRunning, setIsAugRunning] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // When fixture changes, draw on canvas
  useEffect(() => {
    const res = evaluateImageFixture(selectedFixture);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = selectedFixture.width;
    canvas.height = selectedFixture.height;

    // Render pixel buffer
    const rawData = selectedFixture.generateData();
    const imgData = ctx.createImageData(selectedFixture.width, selectedFixture.height);
    imgData.data.set(rawData);
    ctx.putImageData(imgData, 0, 0);

    // Overlay detected ROI rectangle
    ctx.strokeStyle = '#0b6e7f';
    ctx.lineWidth = 2;
    ctx.strokeRect(res.roiDetected.x, res.roiDetected.y, res.roiDetected.width, res.roiDetected.height);

    // Overlay centroid center line
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(res.roiDetected.x, res.extractedCenterY);
    ctx.lineTo(res.roiDetected.x + res.roiDetected.width, res.extractedCenterY);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [selectedFixture]);

  const handleRunAugmentations = () => {
    setIsAugRunning(true);
    setTimeout(() => {
      const { results } = runAugmentationStressTest();
      setAugResults(results);
      setIsAugRunning(false);
    }, 450);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Description */}
      <div
        style={{
          background: 'var(--surface-sunken)',
          padding: '14px 18px',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--line)',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Computer Vision & Hardware Capture Laboratory
        </span>
        <h3 style={{ margin: '2px 0 0', fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>
          Optical Dispersion Frames & ROI Diagnostics
        </h3>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ink-2)' }}>
          Tests spatial variance centroid detection (<span className="mono">detectSpectralROI</span>) and column binning on 2D camera frames across tilt, mechanical displacement, shot noise, ambient glare, and saturation.
        </p>
      </div>

      {/* Fixture Selector Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 8,
        }}
      >
        {IMAGE_FIXTURES.map((fix) => {
          const isSelected = fix.id === selectedFixture.id;
          return (
            <button
              key={fix.id}
              type="button"
              className="card"
              style={{
                padding: '8px 10px',
                textAlign: 'left',
                borderRadius: 'var(--r-sm)',
                border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                background: isSelected ? 'var(--surface-sunken)' : 'var(--surface-raised)',
                cursor: 'pointer',
              }}
              onClick={() => setSelectedFixture(fix)}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{fix.name}</div>
            </button>
          );
        })}
      </div>

      {/* Interactive Canvas & Diagnostics Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(380px, 440px) 1fr', gap: 20 }}>
        {/* Left: Canvas Frame */}
        <div
          style={{
            background: 'var(--surface-plot)',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--line)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', color: '#f2f1ee', fontSize: 12 }}>
            <span style={{ fontWeight: 600 }}>2D CMOS Optical Dispersion Frame</span>
            <span className="mono" style={{ opacity: 0.7 }}>{selectedFixture.width} × {selectedFixture.height} px</span>
          </div>

          <div
            style={{
              width: '100%',
              borderRadius: 'var(--r-sm)',
              overflow: 'hidden',
              display: 'flex',
              justifyContent: 'center',
              background: '#0a0b0d',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', display: 'block' }} />
          </div>

          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af' }}>
            <span><span style={{ color: '#0b6e7f', fontWeight: 600 }}>■</span> Detected ROI Box</span>
            <span><span style={{ color: '#e11d48', fontWeight: 600 }}>- -</span> Centroid Y ({fixtureResult?.extractedCenterY}px)</span>
          </div>
        </div>

        {/* Right: CV Diagnostic Metrics */}
        {fixtureResult && (
          <div
            style={{
              background: 'var(--surface-raised)',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--line)',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase' }}>
                Computer Vision Analysis
              </span>
              <h4 style={{ margin: '2px 0 4px', fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>
                {selectedFixture.name}
              </h4>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.4 }}>
                {selectedFixture.description}
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 10,
                background: 'var(--surface-sunken)',
                padding: 12,
                borderRadius: 'var(--r-sm)',
                fontSize: 12,
              }}
            >
              <div>
                <span style={{ color: 'var(--ink-3)', display: 'block', fontSize: 11 }}>ROI BOUNDS</span>
                <span className="mono tnum" style={{ fontWeight: 600 }}>
                  X:{fixtureResult.roiDetected.x} Y:{fixtureResult.roiDetected.y} W:{fixtureResult.roiDetected.width} H:{fixtureResult.roiDetected.height}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--ink-3)', display: 'block', fontSize: 11 }}>MAX CMOS SIGNAL</span>
                <span className="mono tnum" style={{ fontWeight: 600, color: fixtureResult.isSaturated ? 'var(--alert)' : 'var(--ink)' }}>
                  {fixtureResult.maxSignal.toFixed(1)} / 255 {fixtureResult.isSaturated && '(SATURATED)'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--ink-3)', display: 'block', fontSize: 11 }}>EXTRACTED BANDS</span>
                <span className="mono tnum" style={{ fontWeight: 600 }}>
                  {fixtureResult.extractedProfileLength} channels (resampled)
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--ink-3)', display: 'block', fontSize: 11 }}>PREDICTED CONC</span>
                <span className="mono tnum" style={{ fontWeight: 600, color: fixtureResult.isRejected ? 'var(--alert)' : 'var(--ink)' }}>
                  {fixtureResult.isRejected ? 'REJECTED' : `${fixtureResult.predictedConcentration?.toFixed(2)} mg/L`}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--r-sm)',
                  background: fixtureResult.qcStatus === 'PASS' ? 'var(--pass-quiet)' : 'var(--alert-quiet)',
                  color: fixtureResult.qcStatus === 'PASS' ? 'var(--pass)' : 'var(--alert)',
                  fontWeight: 600,
                }}
              >
                QC: {fixtureResult.qcStatus}
              </span>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--r-sm)',
                  background: fixtureResult.oodStatus === 'IN_DISTRIBUTION' ? 'var(--pass-quiet)' : 'var(--alert-quiet)',
                  color: fixtureResult.oodStatus === 'IN_DISTRIBUTION' ? 'var(--pass)' : 'var(--alert)',
                  fontWeight: 600,
                }}
              >
                OOD: {fixtureResult.oodStatus}
              </span>
            </div>

            <div
              style={{
                fontSize: 12,
                color: fixtureResult.behaviorPass ? 'var(--pass)' : 'var(--alert)',
                background: fixtureResult.behaviorPass ? 'var(--pass-quiet)' : 'var(--alert-quiet)',
                padding: '8px 12px',
                borderRadius: 'var(--r-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {fixtureResult.behaviorPass ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
              <span>{fixtureResult.notes}</span>
            </div>
          </div>
        )}
      </div>

      {/* Augmentation Robustness Stress Section */}
      <div
        style={{
          background: 'var(--surface-raised)',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--line)',
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
              Optical Frame Augmentation & Perturbation Suite
            </h4>
            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              Evaluates how pipeline outputs respond to brightness drift, contrast changes, Gaussian shot noise, spatial translations, and blur.
            </span>
          </div>

          <button
            type="button"
            className="btn btn--primary"
            onClick={handleRunAugmentations}
            disabled={isAugRunning}
            style={{ padding: '6px 14px' }}
          >
            <Play size={13} aria-hidden="true" />
            <span>{isAugRunning ? 'Transforming Frames…' : 'Run Augmentation Tests'}</span>
          </button>
        </div>

        {augResults && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--surface-sunken)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px' }}>Transformation</th>
                  <th style={{ padding: '8px 10px' }}>ROI Center Y</th>
                  <th style={{ padding: '8px 10px' }}>Max Signal</th>
                  <th style={{ padding: '8px 10px' }}>Predicted</th>
                  <th style={{ padding: '8px 10px' }}>Uncertainty</th>
                  <th style={{ padding: '8px 10px' }}>Delta vs Baseline</th>
                  <th style={{ padding: '8px 10px' }}>QC</th>
                  <th style={{ padding: '8px 10px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {augResults.map((aug) => (
                  <tr key={aug.type} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{aug.description}</td>
                    <td className="mono" style={{ padding: '8px 10px' }}>{aug.roiCenterY}px</td>
                    <td className="mono" style={{ padding: '8px 10px' }}>{aug.maxSignal.toFixed(0)}</td>
                    <td className="mono tnum" style={{ padding: '8px 10px', fontWeight: 600 }}>
                      {aug.isRejected ? 'REJECTED' : `${aug.predictedConcentration?.toFixed(2)} mg/L`}
                    </td>
                    <td className="mono tnum" style={{ padding: '8px 10px' }}>
                      {aug.uncertainty ? `±${aug.uncertainty.toFixed(2)}` : '—'}
                    </td>
                    <td className="mono tnum" style={{ padding: '8px 10px' }}>
                      {aug.deltaFromBaselineMgL !== null ? `${aug.deltaFromBaselineMgL.toFixed(3)} mg/L` : '—'}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span className={`badge ${aug.qcStatus === 'PASS' ? 'badge--pass' : 'badge--alert'}`}>
                        {aug.qcStatus}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ color: aug.isRejected ? 'var(--alert)' : 'var(--pass)' }}>
                        {aug.isRejected ? 'Rejected' : 'Passed'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
