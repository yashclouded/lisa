// LISA: Optical spectrum plot
// The one dark surface in the product. Rendered at true device pixels rather
// than scaled from a fixed viewBox, so axis labels stay legible from 320 px
// phone widths to full desktop without horizontal scrolling.

import React, { useEffect, useRef, useState } from 'react';
import { Layers } from 'lucide-react';
import { CFL_REFERENCE_LINES } from '../engine/wavelength';
import { Segmented } from './ui/Segmented';

type ViewMode = 'absorbance' | 'transmission';

interface SpectrumViewerProps {
  wavelengths: number[];
  absorbances: number[];
  rawIntensities?: number[];
  blankIntensities?: number[];
  bandStartNm?: number;
  bandEndNm?: number;
  peakNm?: number;
  sampleName?: string;
  isRejected?: boolean;
  /** False until the first measurement completes. */
  hasMeasurement?: boolean;
  /** True while the pipeline is running, for the sweep affordance. */
  isScanning?: boolean;
}

const MIN_NM = 400;
const MAX_NM = 700;

// Axis ink is held at ≥4.5:1 against the plot surface so the tick labels stay
// readable in daylight and in greyscale, not just on a colour-managed display.
const INK_AXIS = 'rgba(242, 241, 238, 0.52)';
const INK_LABEL = 'rgba(242, 241, 238, 0.72)';
const GRID = 'rgba(255, 255, 255, 0.055)';
const TRACE = '#5fc6d4';
const TRACE_REJECTED = '#ee8079';
const BAND_FILL = 'rgba(95, 198, 212, 0.07)';
const BAND_EDGE = 'rgba(95, 198, 212, 0.28)';
const REF_LINE = 'rgba(224, 174, 85, 0.45)';

export const SpectrumViewer: React.FC<SpectrumViewerProps> = ({
  wavelengths,
  absorbances,
  rawIntensities,
  blankIntensities,
  bandStartNm = 630,
  bandEndNm = 690,
  peakNm = 675,
  sampleName = 'Sample spectrum',
  isRejected = false,
  hasMeasurement = false,
  isScanning = false,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('absorbance');
  const [showRefLines, setShowRefLines] = useState(true);
  const [hover, setHover] = useState<{ nm: number; val: number; x: number; y: number } | null>(
    null
  );

  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(0);

  // Measure the actual pixel width so the plot renders 1:1 — no viewBox scaling,
  // so type stays the size it was designed at on every viewport.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const apply = (w: number) => setWidth(Math.max(280, Math.round(w)));
    apply(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) apply(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = width > 0 && width < 620 ? 296 : 400;
  const pad = { top: 34, right: 24, bottom: 62, left: 58 };
  const plotW = Math.max(60, width - pad.left - pad.right);
  const plotH = Math.max(60, height - pad.top - pad.bottom);

  const getX = (nm: number) => pad.left + ((nm - MIN_NM) / (MAX_NM - MIN_NM)) * plotW;

  const maxAbsY = Math.max(1.2, Math.min(3.0, Math.max(...absorbances, 0.5) * 1.25));
  const maxTransY = 260;

  const getAbsY = (val: number) => pad.top + plotH - (Math.max(0, val) / maxAbsY) * plotH;
  const getTransY = (val: number) => pad.top + plotH - (Math.max(0, val) / maxTransY) * plotH;

  const showAbs = viewMode === 'absorbance';

  const absPath = wavelengths
    .map((nm, i) => `${getX(nm).toFixed(1)},${getAbsY(absorbances[i] || 0).toFixed(1)}`)
    .join(' L ');
  const absLine = absPath ? `M ${absPath}` : '';
  const absArea = absLine
    ? `${absLine} L ${getX(MAX_NM).toFixed(1)},${(pad.top + plotH).toFixed(1)} L ${getX(
        MIN_NM
      ).toFixed(1)},${(pad.top + plotH).toFixed(1)} Z`
    : '';

  const transPath = (values?: number[]) =>
    values && values.length === wavelengths.length
      ? `M ${wavelengths
          .map((nm, i) => `${getX(nm).toFixed(1)},${getTransY(values[i]).toFixed(1)}`)
          .join(' L ')}`
      : '';

  const sampleTrans = transPath(rawIntensities);
  const blankTrans = transPath(blankIntensities);

  const bandIdx = wavelengths
    .map((nm, i) => (nm >= bandStartNm && nm <= bandEndNm ? i : -1))
    .filter((i) => i !== -1);
  const bandVals = bandIdx.map((i) => absorbances[i] || 0);
  const peakBandAbs = bandVals.length > 0 ? Math.max(...bandVals) : 0;

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!hasMeasurement) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const normX = Math.max(0, Math.min(1, (e.clientX - rect.left - pad.left) / plotW));
    const nmAt = MIN_NM + normX * (MAX_NM - MIN_NM);
    const idx = Math.max(
      0,
      Math.min(wavelengths.length - 1, Math.round((nmAt - MIN_NM) / 2))
    );
    const nm = wavelengths[idx];
    const val = showAbs ? absorbances[idx] || 0 : rawIntensities?.[idx] ?? 0;
    setHover({ nm, val, x: getX(nm), y: showAbs ? getAbsY(val) : getTransY(val) });
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    ratio,
    y: pad.top + plotH * (1 - ratio),
    label: showAbs ? (ratio * maxAbsY).toFixed(2) : String(Math.round(ratio * maxTransY)),
  }));

  const peakY = getAbsY(peakBandAbs);
  const peakLabelY = Math.max(pad.top + 11, peakY - 11);

  return (
    <div className="card card--plot">
      <div className="card__head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span className="card__title">
            {showAbs ? 'Optical absorbance A(λ)' : 'Sensor transmission I(λ)'}
          </span>
          <span className="card__sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {sampleName}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            aria-pressed={showRefLines}
            onClick={() => setShowRefLines((v) => !v)}
            title="Show mercury emission reference lines used for wavelength registration (436, 546, 611 nm)"
          >
            <Layers size={13} aria-hidden="true" />
            <span className="plot-toggle-label">CFL lines</span>
          </button>

          <Segmented<ViewMode>
            label="Plot view"
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'absorbance', label: 'Absorbance' },
              { value: 'transmission', label: 'Transmission' },
            ]}
          />
        </div>
      </div>

      <div
        className="plot__canvas"
        ref={canvasRef}
        style={{ position: 'relative', minHeight: height }}
      >
        {width > 0 && (
          <svg
            ref={svgRef}
            width={width}
            height={height}
            role="img"
            aria-label={
              hasMeasurement
                ? `${showAbs ? 'Absorbance' : 'Transmission'} spectrum from 400 to 700 nanometres for ${sampleName}. Target band ${bandStartNm} to ${bandEndNm} nanometres, peak at ${peakNm} nanometres.`
                : 'Spectrum plot awaiting first measurement.'
            }
            onMouseMove={handleMove}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id="lisaBand" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#7b1fa2" />
                <stop offset="15%" stopColor="#303f9f" />
                <stop offset="30%" stopColor="#1976d2" />
                <stop offset="45%" stopColor="#0097a7" />
                <stop offset="60%" stopColor="#388e3c" />
                <stop offset="75%" stopColor="#fbc02d" />
                <stop offset="90%" stopColor="#e64a19" />
                <stop offset="100%" stopColor="#d32f2f" />
              </linearGradient>

              <linearGradient id="lisaAbsFill" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop
                  offset="0%"
                  stopColor={isRejected ? TRACE_REJECTED : TRACE}
                  stopOpacity="0.18"
                />
                <stop
                  offset="100%"
                  stopColor={isRejected ? TRACE_REJECTED : TRACE}
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>

            {/* Horizontal grid */}
            {yTicks.map((tick) => (
              <g key={tick.ratio}>
                <line
                  x1={pad.left}
                  y1={tick.y}
                  x2={pad.left + plotW}
                  y2={tick.y}
                  stroke={GRID}
                  strokeWidth="1"
                  shapeRendering="crispEdges"
                />
                <text
                  x={pad.left - 10}
                  y={tick.y + 3.5}
                  fill={INK_AXIS}
                  fontSize="11"
                  textAnchor="end"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {/* Vertical grid + wavelength labels */}
            {[400, 450, 500, 550, 600, 650, 700].map((nm) => (
              <g key={nm}>
                <line
                  x1={getX(nm)}
                  y1={pad.top}
                  x2={getX(nm)}
                  y2={pad.top + plotH}
                  stroke={GRID}
                  strokeWidth="1"
                  shapeRendering="crispEdges"
                />
                <text
                  x={getX(nm)}
                  y={pad.top + plotH + 16}
                  fill={INK_AXIS}
                  fontSize="11"
                  textAnchor="middle"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {nm}
                </text>
              </g>
            ))}

            {/* Target chromophore band */}
            {showAbs && (
              <>
                <rect
                  x={getX(bandStartNm)}
                  y={pad.top}
                  width={Math.max(0, getX(bandEndNm) - getX(bandStartNm))}
                  height={plotH}
                  fill={BAND_FILL}
                />
                <line
                  x1={getX(bandStartNm)}
                  y1={pad.top}
                  x2={getX(bandStartNm)}
                  y2={pad.top + plotH}
                  stroke={BAND_EDGE}
                  strokeWidth="1"
                />
                <line
                  x1={getX(bandEndNm)}
                  y1={pad.top}
                  x2={getX(bandEndNm)}
                  y2={pad.top + plotH}
                  stroke={BAND_EDGE}
                  strokeWidth="1"
                />
                <text
                  x={(getX(bandStartNm) + getX(bandEndNm)) / 2}
                  y={pad.top + 14}
                  fill={BAND_EDGE}
                  fontSize="10.5"
                  textAnchor="middle"
                  letterSpacing="0.04em"
                >
                  {bandStartNm}–{bandEndNm} nm
                </text>
              </>
            )}

            {/* Mercury reference lines for wavelength registration */}
            {showRefLines &&
              CFL_REFERENCE_LINES.map((ref) => (
                <g key={ref.name}>
                  <line
                    x1={getX(ref.trueNm)}
                    y1={pad.top}
                    x2={getX(ref.trueNm)}
                    y2={pad.top + plotH}
                    stroke={REF_LINE}
                    strokeWidth="1"
                    strokeDasharray="2 3"
                  />
                  <text
                    x={getX(ref.trueNm)}
                    y={pad.top - 9}
                    fill={REF_LINE}
                    fontSize="10"
                    textAnchor="middle"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {ref.trueNm}
                  </text>
                </g>
              ))}

            {/* Trace */}
            {hasMeasurement && showAbs && (
              <>
                <path d={absArea} fill="url(#lisaAbsFill)" />
                <path
                  key={`abs-${sampleName}-${absorbances.length}-${peakBandAbs.toFixed(3)}`}
                  className="plot-trace"
                  d={absLine}
                  fill="none"
                  stroke={isRejected ? TRACE_REJECTED : TRACE}
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={1}
                />
              </>
            )}

            {hasMeasurement && !showAbs && (
              <>
                {blankTrans && (
                  <path
                    d={blankTrans}
                    fill="none"
                    stroke="rgba(242, 241, 238, 0.34)"
                    strokeWidth="1.25"
                    strokeDasharray="4 3"
                  />
                )}
                {sampleTrans && (
                  <path
                    key={`trans-${sampleName}-${sampleTrans.length}`}
                    className="plot-trace"
                    d={sampleTrans}
                    fill="none"
                    stroke={TRACE}
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pathLength={1}
                  />
                )}
              </>
            )}

            {/* Peak marker on the 675 nm target */}
            {hasMeasurement && showAbs && peakBandAbs > 0.05 && (
              <g>
                <line
                  x1={getX(peakNm)}
                  y1={pad.top}
                  x2={getX(peakNm)}
                  y2={pad.top + plotH}
                  stroke="rgba(255, 255, 255, 0.22)"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
                <circle
                  cx={getX(peakNm)}
                  cy={peakY}
                  r="3.5"
                  fill="#ffffff"
                  stroke={isRejected ? TRACE_REJECTED : TRACE}
                  strokeWidth="2"
                />
                <text
                  x={getX(peakNm)}
                  y={peakLabelY}
                  fill={INK_LABEL}
                  fontSize="11"
                  textAnchor="middle"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {peakNm} nm
                </text>
              </g>
            )}

            {/* Hover crosshair */}
            {hover && hasMeasurement && (
              <g pointerEvents="none">
                <line
                  x1={hover.x}
                  y1={pad.top}
                  x2={hover.x}
                  y2={pad.top + plotH}
                  stroke="rgba(255, 255, 255, 0.3)"
                  strokeWidth="1"
                />
                <circle cx={hover.x} cy={hover.y} r="3.5" fill="#ffffff" />
              </g>
            )}

            {/* Spectral band strip — maps position on the axis to perceived colour */}
            <rect
              x={pad.left}
              y={pad.top + plotH + 24}
              width={plotW}
              height="5"
              rx="2.5"
              fill="url(#lisaBand)"
              opacity="0.62"
            />

            {/* Axis titles */}
            <text
              x={pad.left + plotW / 2}
              y={height - 12}
              fill={INK_AXIS}
              fontSize="11.5"
              textAnchor="middle"
            >
              Wavelength (nm)
            </text>
            <text
              x={14}
              y={pad.top + plotH / 2}
              fill={INK_AXIS}
              fontSize="11.5"
              textAnchor="middle"
              transform={`rotate(-90 14 ${pad.top + plotH / 2})`}
            >
              {showAbs ? 'Absorbance (AU)' : 'Intensity (0–255)'}
            </text>

            {/* Awaiting-capture state, drawn inside the axes so layout never jumps */}
            {!hasMeasurement && (
              <text
                x={pad.left + plotW / 2}
                y={pad.top + plotH / 2}
                fill="rgba(242, 241, 238, 0.32)"
                fontSize="13"
                textAnchor="middle"
              >
                {isScanning ? 'Acquiring optical signal…' : 'Awaiting first capture'}
              </text>
            )}
          </svg>
        )}

        {hover && hasMeasurement && (
          <div className="chart-readout" aria-hidden="true">
            <span>
              <span className="chart-readout__key">λ </span>
              {hover.nm} nm
            </span>
            <span>
              <span className="chart-readout__key">{showAbs ? 'A ' : 'I '}</span>
              {showAbs ? hover.val.toFixed(4) : hover.val.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      <div className="plot__legend">
        <span className="plot__legend-item">
          <span className="plot__legend-key">Peak absorbance</span>
          <span className="plot__legend-value">
            {hasMeasurement ? `${peakBandAbs.toFixed(4)} AU` : '—'}
          </span>
        </span>
        <span className="plot__legend-item">
          <span className="plot__legend-key">Target band</span>
          <span className="plot__legend-value">
            {bandStartNm}–{bandEndNm} nm
          </span>
        </span>
        {!showAbs && (
          <>
            <span className="plot__legend-item">
              <span className="plot__swatch" style={{ background: TRACE }} />
              <span>Sample</span>
            </span>
            <span className="plot__legend-item">
              <span
                className="plot__swatch"
                style={{ background: 'rgba(242, 241, 238, 0.34)' }}
              />
              <span>Blank</span>
            </span>
          </>
        )}
        <span className="plot__legend-item" style={{ marginLeft: 'auto' }}>
          151 bands · 2 nm grid
        </span>
      </div>
    </div>
  );
};
