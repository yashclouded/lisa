// LISA Simulation Lab — one simulated measurement, every stage of the chain.
// Controls → SimulationConfig → runSimulation() (production simulator + pipeline)
// → the panels below. Panels only read the SimulationState; none compute chemistry.

import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Box, Pause, Play, RotateCcw, Film, SkipForward } from 'lucide-react';
import { INTERFERENTS, InterferentKind, reactionProgress } from '../engine/simulator';
import { DEMO_DEVICES } from '../engine/deviceCalibration';
import { STANDARD_WAVELENGTHS } from '../engine/spectrum';
import { CFL_REFERENCE_LINES } from '../engine/wavelength';
import { StatusPill, QC_TONE, QC_WORD, VERDICT_TONE, Tone } from '../components/ui/Status';
import { Segmented } from '../components/ui/Segmented';
import { transmittedColor, drawSensorFrame, pixelOfWavelength, SENSOR_COLUMNS } from '../digitalTwin/twinModel';
import { runSimulation, summarize, SimulationConfig } from './state';
import { BASE_CONFIG, HERO_SCENARIOS, PRESETS } from './scenarios';
import { runSweep, SWEEPS, SweepKey, SweepPoint, INTERFERENT_KINDS } from './sweeps';
import { simulateWavelengthCalibration } from './wavecal';
import '../digitalTwin/digitalTwin.css';
import './simulationLab.css';

const WL = STANDARD_WAVELENGTHS;
const MODEL_NAME = { ridge: 'Full-spectrum Ridge', 'beer-lambert': 'Beer–Lambert band', none: 'None' } as const;
const f3 = (v: number | null | undefined) => (v == null ? '—' : v.toFixed(3));

// ---------------------------------------------------------------------------
// Plot — minimal SVG line chart on the dark plot surface.
// ---------------------------------------------------------------------------

interface Series {
  y: (number | null)[];
  cls: string;
  x?: number[];
}

const Plot: React.FC<{
  x: number[];
  series: Series[];
  y: [number, number];
  xLabel: string;
  yLabel: string;
  band?: [number, number];
  hlines?: { y: number; label: string }[];
  errors?: { x: number; lo: number; hi: number }[];
  xTicks?: number[];
  xFmt?: (v: number) => string;
  label: string;
  wide?: boolean;
}> = ({ x, series, y, xLabel, yLabel, band, hlines, errors, xTicks, xFmt = String, label, wide }) => {
  const W = wide ? 1000 : 560, H = wide ? 230 : 210, L = 44, R = 10, T = 10, B = 30;
  const x0 = Math.min(...x), x1 = Math.max(...x);
  const sx = (v: number) => L + ((v - x0) / (x1 - x0 || 1)) * (W - L - R);
  const sy = (v: number) => H - B - ((Math.min(y[1], Math.max(y[0], v)) - y[0]) / (y[1] - y[0] || 1)) * (H - T - B);
  const yt = [0, 0.25, 0.5, 0.75, 1].map((k) => y[0] + k * (y[1] - y[0]));
  const path = (s: Series) => {
    const xs = s.x ?? x;
    let d = '';
    let pen = false;
    s.y.forEach((v, i) => {
      if (v == null || !Number.isFinite(v)) return void (pen = false);
      d += `${pen ? 'L' : 'M'}${sx(xs[i]).toFixed(1)},${sy(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  return (
    <svg className="lab-plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {band && <rect className="lab-plot__band" x={sx(band[0])} y={T} width={sx(band[1]) - sx(band[0])} height={H - T - B} />}
      {yt.map((v) => (
        <g key={v}>
          <line className="lab-plot__grid" x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} />
          <text className="lab-plot__tick" x={L - 6} y={sy(v) + 3} textAnchor="end">
            {Math.abs(y[1] - y[0]) >= 10 ? v.toFixed(0) : v.toFixed(2)}
          </text>
        </g>
      ))}
      {(xTicks ?? [x0, (x0 + x1) / 2, x1]).map((v) => (
        <text key={v} className="lab-plot__tick" x={sx(v)} y={H - B + 14} textAnchor="middle">
          {xFmt(v)}
        </text>
      ))}
      {hlines?.map((h) => (
        <g key={h.label}>
          <line className="lab-plot__hline" x1={L} x2={W - R} y1={sy(h.y)} y2={sy(h.y)} />
          <text className="lab-plot__tick lab-plot__tick--hl" x={W - R - 4} y={sy(h.y) - 4} textAnchor="end">
            {h.label}
          </text>
        </g>
      ))}
      {errors?.map((e) => (
        <line key={e.x} className="lab-plot__err" x1={sx(e.x)} x2={sx(e.x)} y1={sy(e.lo)} y2={sy(e.hi)} />
      ))}
      {series.map((s, i) => (
        <path key={i} className={`lab-plot__line ${s.cls}`} d={path(s)} />
      ))}
      <text className="lab-plot__axis" x={W - R} y={H - 4} textAnchor="end">{xLabel}</text>
      <text className="lab-plot__axis" x={4} y={T + 2} dominantBaseline="hanging">{yLabel}</text>
    </svg>
  );
};

const Key: React.FC<{ cls: string; children: React.ReactNode }> = ({ cls, children }) => (
  <span className="lab-key"><span className={`lab-key__sw ${cls}`} />{children}</span>
);

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

const Slider: React.FC<{
  id: string; label: string; value: number; min: number; max: number; step: number;
  fmt: (v: number) => string; onChange: (v: number) => void; hint?: string;
}> = ({ id, label, value, min, max, step, fmt, onChange, hint }) => (
  <div className="field">
    <div className="field__label">
      <label htmlFor={id}>{label}</label>
      <span className="field__value mono">{fmt(value)}</span>
    </div>
    <input id={id} type="range" className="slider" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    {hint && <span className="field__hint">{hint}</span>}
  </div>
);

const SensorRow: React.FC<{ intensities: number[]; label: string }> = ({ intensities, label }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawSensorFrame(ref.current, intensities);
  }, [intensities]);
  // Clipped bins (≥ 250 counts), placed by the same grating geometry as the strip.
  const clipped = intensities.flatMap((v, i) => (v >= 250 ? [pixelOfWavelength(WL[i]) / (SENSOR_COLUMNS - 1)] : []));
  return (
    <div className="lab-sensor">
      <span className="lab-sensor__label">{label}</span>
      <div className="lab-sensor__strip">
        <canvas ref={ref} width={720} height={36} aria-label={`${label} sensor row`} />
        {clipped.map((x, k) => (
          <span key={k} className="lab-sensor__clip" style={{ left: `${x * 100}%` }} />
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------

const STAGES = ['Chemistry', 'Light', 'Sensor', 'Spectrum', 'Model', 'Result'];

const SimulationLab: React.FC = () => {
  const [cfg, setCfg] = useState<SimulationConfig>(HERO_SCENARIOS[0].config);
  const [heroId, setHeroId] = useState<string | null>(HERO_SCENARIOS[0].id);
  const set = <K extends keyof SimulationConfig>(k: K, v: SimulationConfig[K]) => {
    setCfg((c) => ({ ...c, [k]: v, id: undefined }));
    setHeroId(null);
  };
  const deferred = useDeferredValue(cfg);
  const s = useMemo(() => runSimulation(deferred), [deferred]);
  const r = s.result;
  const rec = r.record;
  const sum = summarize(s);

  // ---- Reaction playback (0 → 15 min, 2 simulated min per real second) ----
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      let done = false;
      setCfg((c) => {
        const t = Math.round(((c.reactionTimeMin ?? 0) + dt * 2) * 10) / 10;
        done = t >= 15;
        return { ...c, reactionTimeMin: Math.min(15, t), id: undefined };
      });
      if (done) setPlaying(false);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // ---- Chain replay: steps a highlight through the six panels ----
  const [replay, setReplay] = useState<number | null>(null);
  useEffect(() => {
    if (replay == null) return;
    document.getElementById(`lab-stage-${replay}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = window.setTimeout(() => setReplay(replay >= STAGES.length - 1 ? null : replay + 1), 1600);
    return () => window.clearTimeout(t);
  }, [replay]);
  const stageCls = (i: number) => `card lab-panel${replay === i ? ' is-active' : ''}`;

  // ---- Derived views (all reads of s) ----
  const peakIdx = Math.round((s.analyte.peakWavelength - 400) / 2);
  const iB = s.sim.blankIntensities[peakIdx];
  const iS = r.alignedProfile[peakIdx];
  const { rgb } = transmittedColor(s.sim.blankIntensities, s.sim.sampleIntensities);
  const swatch = `rgb(${rgb.map((c) => Math.round(Math.max(0, Math.min(1, c * c)) * 255)).join(',')})`;
  const progress = reactionProgress(s.params.analyte, s.params.reactionTimeMin);
  const absMax = Math.max(0.3, ...s.sim.trueAbsorbance, ...r.absorbances) * 1.1;
  const oodTone: Tone = r.ood.status === 'IN_DISTRIBUTION' ? 'pass' : r.ood.status === 'BORDERLINE' ? 'caution' : 'alert';
  const err = s.truth != null && rec.concentration != null ? rec.concentration - s.truth : null;
  const interferent = cfg.interferents?.[0];
  const qcChecks = [r.qc.saturationCheck, r.qc.signalStrengthCheck, r.qc.spectralShiftCheck, r.qc.calibrationRangeCheck, r.qc.turbidityInterferenceCheck];
  const hero = HERO_SCENARIOS.find((h) => h.id === heroId);
  const twinHref = heroId ? `#/twin?hero=${heroId}` : `#/twin?cfg=${encodeURIComponent(JSON.stringify(cfg))}`;
  const conc = cfg.analyte === 'lead' ? { max: 2, step: 0.005, unit: 'mg Pb/L' } : { max: 1.5, step: 0.01, unit: 'mg P/L' };

  // ---- Sweeps (run on demand, never while animating) ----
  const [sweepKey, setSweepKey] = useState<SweepKey>('concentration');
  const [sweep, setSweep] = useState<{ key: SweepKey; points: SweepPoint[]; ms: number } | null>(null);
  const sweepDef = SWEEPS.find((w) => w.key === sweepKey)!;
  const doSweep = () => {
    const t0 = performance.now();
    const points = runSweep(cfg, sweepKey, sweepDef.values);
    setSweep({ key: sweepKey, points, ms: Math.round(performance.now() - t0) });
  };

  // ---- Wavelength calibration lab ----
  const [wc, setWc] = useState({ pixelNoise: 0.5, shiftPx: 0, dropLine: null as string | null });
  const wcal = useMemo(() => simulateWavelengthCalibration({ ...wc, seed: 'LISA-WAVECAL' }), [wc]);

  return (
    <div className="twin lab">
      <header className="twin-bar">
        <a className="btn btn--ghost btn--sm" href="#/">
          <ArrowLeft size={15} aria-hidden="true" /> Instrument
        </a>
        <div className="twin-bar__title">
          <span className="brand__mark">LISA</span>
          <span className="twin-bar__name">Simulation lab</span>
          <StatusPill tone="caution">Simulated</StatusPill>
        </div>
        <span className="card__sub mono">{s.id} · seed {s.seed} · {s.provenance.configVersion}</span>
        <div className="twin-bar__spacer" />
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => setReplay(0)} disabled={replay != null}>
          <SkipForward size={14} aria-hidden="true" /> Replay chain
        </button>
        <a className="btn btn--secondary btn--sm" href={twinHref}>
          <Box size={14} aria-hidden="true" /> Open in 3D twin
        </a>
        <a className="btn btn--primary btn--sm" href="#/twin?cinema=1&autoplay=1">
          <Film size={14} aria-hidden="true" /> Cinematic mode
        </a>
      </header>

      <section className="lab-heroes" aria-label="Hero scenarios">
        <div className="twin-chips">
          {HERO_SCENARIOS.map((h) => (
            <button key={h.id} type="button" className="twin-chip" aria-pressed={heroId === h.id} title={h.story}
              onClick={() => { setCfg(h.config); setHeroId(h.id); setPlaying(false); }}>
              {h.label}
            </button>
          ))}
        </div>
        <p className="lab-story">
          {hero ? <><b>{hero.id}</b> — {hero.story}</> : 'Custom configuration.'} Outcome below is computed by the
          production pipeline from the simulated spectrum; the simulated truth is never passed to inference.
        </p>
      </section>

      <div className="lab-main">
        {/* ---------------- Controls ---------------- */}
        <aside className="card lab-controls" aria-label="Simulation parameters">
          <div className="card__head"><span className="card__title">Parameters</span></div>
          <div className="card__body stack" style={{ gap: 14 }}>
            <div className="twin-chips" role="group" aria-label="Presets">
              {PRESETS.map((p) => (
                <button key={p.id} type="button" className="twin-chip" onClick={() => { setCfg((c) => ({ ...c, ...p.over, id: undefined })); setHeroId(null); }}>
                  {p.label}
                </button>
              ))}
            </div>

            <Segmented<'phosphate' | 'lead'>
              label="Assay chemistry" block value={cfg.analyte === 'lead' ? 'lead' : 'phosphate'}
              onChange={(a) => { setCfg((c) => ({ ...c, analyte: a, concentration: a === 'lead' ? 0.5 : 0.4, id: undefined })); setHeroId(null); }}
              options={[{ value: 'phosphate', label: 'Phosphate' }, { value: 'lead', label: 'Lead (sim.)' }]}
            />
            <Slider id="l-conc" label="Concentration (truth)" value={cfg.concentration} min={0} max={conc.max} step={conc.step}
              fmt={(v) => `${v.toFixed(3)} ${conc.unit}`} onChange={(v) => set('concentration', v)} />

            <div className="field">
              <div className="field__label">
                <label htmlFor="l-time">Reaction time</label>
                <span className="field__value mono">
                  {cfg.reactionTimeMin == null ? 'end-point' : `${cfg.reactionTimeMin.toFixed(1)} min`} · {(progress * 100).toFixed(0)} %
                </span>
              </div>
              <input id="l-time" type="range" className="slider" min={0} max={20} step={0.1} value={cfg.reactionTimeMin ?? 20}
                onChange={(e) => set('reactionTimeMin', +e.target.value)} />
              <div className="lab-row">
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => {
                  if (!playing && (cfg.reactionTimeMin == null || cfg.reactionTimeMin >= 15)) set('reactionTimeMin', 0);
                  setPlaying((p) => !p);
                }}>
                  {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />} {playing ? 'Pause' : 'Play reaction'}
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setPlaying(false); set('reactionTimeMin', undefined); }}>End-point</button>
              </div>
            </div>

            <Slider id="l-path" label="Path length" value={cfg.pathLengthCm ?? 1} min={0.25} max={2} step={0.05}
              fmt={(v) => `${v.toFixed(2)} cm`} onChange={(v) => set('pathLengthCm', v)} hint="Calibration was built at 1.00 cm." />

            <div className="field">
              <label className="field__label" htmlFor="l-int">Interferent</label>
              <select id="l-int" className="select select--block" value={interferent?.kind ?? ''}
                onChange={(e) => set('interferents', e.target.value ? [{ kind: e.target.value as InterferentKind, peakAU: interferent?.peakAU ?? 0.5 }] : [])}>
                <option value="">None</option>
                {INTERFERENT_KINDS.map((k) => <option key={k} value={k}>{INTERFERENTS[k].label}</option>)}
              </select>
              {interferent && (
                <>
                  <input type="range" className="slider" aria-label="Interferent strength" min={0} max={1.5} step={0.02} value={interferent.peakAU}
                    onChange={(e) => set('interferents', [{ kind: interferent.kind, peakAU: +e.target.value }])} />
                  <span className="field__hint">{interferent.peakAU.toFixed(2)} AU peak · {INTERFERENTS[interferent.kind].note}</span>
                </>
              )}
            </div>

            <Slider id="l-turb" label="Turbidity (scatter)" value={cfg.turbidityAU} min={0} max={0.8} step={0.02}
              fmt={(v) => `${v.toFixed(2)} AU @550`} onChange={(v) => set('turbidityAU', v)} />
            <Slider id="l-exp" label="Exposure × gain" value={cfg.exposure ?? 1} min={0.1} max={1.6} step={0.05}
              fmt={(v) => `${v.toFixed(2)}×`} onChange={(v) => set('exposure', v)} />
            <Slider id="l-amb" label="Ambient light leak" value={cfg.ambientLightCounts ?? 0} min={0} max={30} step={1}
              fmt={(v) => `${v} counts`} onChange={(v) => set('ambientLightCounts', v)} />
            <Slider id="l-drift" label="LED drift blank → sample" value={cfg.sourceDrift ?? 0} min={-0.1} max={0.1} step={0.005}
              fmt={(v) => `${(v * 100).toFixed(1)} %`} onChange={(v) => set('sourceDrift', v)} />
            <Slider id="l-shift" label="Cuvette shift" value={cfg.shiftPx} min={-10} max={10} step={1}
              fmt={(v) => `${v > 0 ? '+' : ''}${v} px (${v * 2} nm)`} onChange={(v) => set('shiftPx', v)} />
            <Slider id="l-noise" label="Detector noise" value={cfg.noiseLevel} min={0} max={0.3} step={0.005}
              fmt={(v) => v.toFixed(3)} onChange={(v) => set('noiseLevel', v)} />

            <div className="field">
              <label className="field__label" htmlFor="l-dev">Handset</label>
              <select id="l-dev" className="select select--block" value={cfg.deviceId} onChange={(e) => set('deviceId', e.target.value)}>
                {DEMO_DEVICES.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <label className="switch">
                <input type="checkbox" checked={cfg.deviceCalibrated ?? DEMO_DEVICES.find((d) => d.id === cfg.deviceId)!.isCalibrated}
                  onChange={(e) => set('deviceCalibrated', e.target.checked)} />
                <span className="switch__track" aria-hidden="true" />
                <span>Device calibration applied</span>
              </label>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="l-seed">Seed</label>
              <div className="lab-row">
                <input id="l-seed" className="input mono" value={cfg.seed} onChange={(e) => set('seed', e.target.value)} />
                <button type="button" className="btn btn--ghost btn--icon" aria-label="New noise realisation"
                  onClick={() => set('seed', `${cfg.seed.replace(/-N\d+$/, '')}-N${Math.floor(performance.now()) % 1000}`)}>
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setCfg(BASE_CONFIG); setHeroId(null); }}>Reset to defaults</button>
          </div>
        </aside>

        {/* ---------------- Measurement chain ---------------- */}
        <div className="lab-chain">
          <section id="lab-stage-0" className={stageCls(0)}>
            <div className="card__head"><span className="card__title">1 · Chemistry becomes colour</span><span className="card__sub">true absorbance by cause</span></div>
            <div className="card__body lab-two">
              <div className="lab-cuvette" aria-label="Simulated transmitted colour">
                <div className="lab-cuvette__glass"><div className="lab-cuvette__liquid" style={{ background: swatch }} /></div>
                <div className="lab-cuvette__meta mono">
                  {(progress * 100).toFixed(0)} % developed<br />l = {(cfg.pathLengthCm ?? 1).toFixed(2)} cm
                </div>
              </div>
              <div>
                <Plot label="True absorbance components" x={WL} y={[0, absMax]} xLabel="λ (nm)" yLabel="A (AU)" band={s.analyte.primaryBand}
                  xTicks={[400, 500, 600, 700]}
                  series={[
                    { y: s.sim.components.scatter, cls: 's-scatter' },
                    { y: s.sim.components.interferent, cls: 's-interf' },
                    { y: s.sim.components.analyte, cls: 's-analyte' },
                    { y: s.sim.trueAbsorbance, cls: 's-true' },
                  ]} />
                <div className="lab-keys">
                  <Key cls="s-analyte">{s.analyte.chemicalFormula} complex</Key><Key cls="s-interf">interferent</Key>
                  <Key cls="s-scatter">scatter</Key><Key cls="s-true">total</Key>
                </div>
              </div>
            </div>
          </section>

          <section id="lab-stage-1" className={stageCls(1)}>
            <div className="card__head"><span className="card__title">2 · Blank vs sample: I₀(λ) and I(λ)</span><span className="card__sub">8-bit counts</span></div>
            <div className="card__body">
              <Plot wide label="Blank and sample intensity" x={WL} y={[0, 260]} xLabel="λ (nm)" yLabel="counts" xTicks={[400, 500, 600, 700]}
                hlines={[{ y: 255, label: 'sensor full scale 255' }, ...((cfg.ambientLightCounts ?? 0) > 0 ? [{ y: cfg.ambientLightCounts!, label: 'ambient leak' }] : [])]}
                series={[{ y: s.sim.blankIntensities, cls: 's-blank' }, { y: r.alignedProfile, cls: 's-sample' }]} />
              <div className="lab-keys"><Key cls="s-blank">I₀ blank</Key><Key cls="s-sample">I sample (aligned)</Key></div>
              <p className="lab-note">
                <span className="formula">A = −log₁₀(I / I₀)</span> at {s.analyte.peakWavelength} nm: −log₁₀({iS.toFixed(1)} / {iB.toFixed(1)}) ={' '}
                <b className="mono">{(-Math.log10(Math.max(1e-4, iS) / Math.max(1e-4, iB))).toFixed(3)}</b> AU
                {' '}(true {s.sim.trueAbsorbance[peakIdx].toFixed(3)} AU).
              </p>
            </div>
          </section>

          <section id="lab-stage-2" className={stageCls(2)}>
            <div className="card__head"><span className="card__title">3 · The phone becomes the sensor</span><span className="card__sub">grating geometry → pixel columns</span></div>
            <div className="card__body stack" style={{ gap: 8 }}>
              <SensorRow intensities={s.sim.blankIntensities} label="Blank" />
              <SensorRow intensities={s.sim.sampleIntensities} label="Sample" />
              <div className="metrics lab-metrics">
                <div className="metric"><span>Peak counts</span><span className="mono">{sum.peakCounts} / 255</span></div>
                <div className="metric"><span>Clipped bins</span><span className="mono">{r.alignedProfile.filter((v) => v >= 250).length}</span></div>
                <div className="metric"><span>Cuvette shift / aligner correction</span><span className="mono">{cfg.shiftPx > 0 ? '+' : ''}{cfg.shiftPx} / {r.shiftPx > 0 ? '+' : ''}{r.shiftPx} px</span></div>
              </div>
              <p className="lab-note">Red ticks mark clipped columns. Strip brightness is the simulated intensity, placed by the 1000 l/mm grating equation.</p>
            </div>
          </section>

          <section id="lab-stage-3" className={stageCls(3)}>
            <div className="card__head"><span className="card__title">4 · Light becomes a spectrum</span><span className="card__sub">pipeline absorbance vs simulated truth</span></div>
            <div className="card__body">
              <Plot wide label="Measured versus true absorbance" x={WL} y={[0, absMax]} xLabel="λ (nm)" yLabel="A (AU)" band={s.analyte.primaryBand} xTicks={[400, 500, 600, 700]}
                series={[{ y: s.sim.trueAbsorbance, cls: 's-true' }, { y: r.absorbances, cls: 's-meas' }]} />
              <div className="lab-keys"><Key cls="s-meas">measured (aligned, baseline-corrected)</Key><Key cls="s-true">simulated true A(λ)</Key></div>
              <p className="lab-note">Baseline offset removed: <b className="mono">{f3(r.baselineProfile[0])}</b> AU. Shaded: {s.analyte.primaryBand[0]}–{s.analyte.primaryBand[1]} nm model band.</p>
            </div>
          </section>

          <section id="lab-stage-4" className={stageCls(4)}>
            <div className="card__head"><span className="card__title">5 · Model and trust checks</span><span className="card__sub">quantities from the pipeline, no invented “AI”</span></div>
            <div className="card__body lab-two">
              <div className="metrics">
                <div className="metric"><span>Beer–Lambert estimate</span><span className="mono">{f3(r.beerConcentration)}</span></div>
                <div className="metric"><span>Ridge estimate</span><span className="mono">{f3(r.ridgeConcentration)}</span></div>
                <div className="metric"><span>Grouped-CV RMSE (BL / Ridge)</span><span className="mono">{f3(r.beerMetrics.groupedCvRmse ?? r.beerMetrics.loocvRmse)} / {f3(r.ridgeMetrics.groupedCvRmse ?? r.ridgeMetrics.loocvRmse)}</span></div>
                <div className="metric"><span>Selected</span><span>{MODEL_NAME[rec.selectedModel]}</span></div>
                <div className="metric"><span>OOD distance</span><span className="mono">{r.ood.score} <StatusPill tone={oodTone}>{r.ood.status.replace(/_/g, ' ').toLowerCase()}</StatusPill></span></div>
                <div className="metric"><span>Uncertainty (95 %)</span><span className="mono">{rec.isRejected ? 'withheld' : `± ${f3(rec.uncertainty)}`}</span></div>
              </div>
              <ul className="lab-qc">
                {qcChecks.map((c) => (
                  <li key={c.id} title={c.detail}>
                    <StatusPill tone={QC_TONE[c.status]}>{QC_WORD[c.status]}</StatusPill>
                    <span>{c.name}</span><span className="mono">{c.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section id="lab-stage-5" className={`${stageCls(5)} lab-result`} aria-live="polite">
            <div className="card__head"><span className="card__title">6 · Result</span><span className="card__sub">{s.analyte.name}</span></div>
            <div className="card__body lab-two">
              <div>
                {rec.isRejected ? (
                  <div className="lab-big lab-big--rejected">No trustworthy result</div>
                ) : (
                  <div className="lab-big mono">{f3(rec.concentration)} <small>± {f3(rec.uncertainty)} {rec.unit}</small></div>
                )}
                <div className="twin-result__pills">
                  <StatusPill tone={VERDICT_TONE[rec.verdict]}>{rec.isRejected ? 'Rejected' : rec.verdictLabel}</StatusPill>
                  <StatusPill tone={QC_TONE[r.qc.overallStatus]}>QC {QC_WORD[r.qc.overallStatus]}</StatusPill>
                </div>
                {rec.isRejected && <div className="callout callout--alert">{rec.rejectionReason}</div>}
              </div>
              <div className="metrics">
                <div className="metric"><span>Simulated truth</span><span className="mono">{s.truth == null ? 'not this analyte' : `${s.truth.toFixed(3)} ${rec.unit}`}</span></div>
                <div className="metric"><span>Error vs truth</span><span className="mono">{err == null ? '—' : `${err >= 0 ? '+' : ''}${err.toFixed(3)} (${s.truth ? ((100 * err) / s.truth).toFixed(0) : '—'} %)`}</span></div>
                <div className="metric"><span>Truth inside ± interval</span><span>{err == null ? '—' : Math.abs(err) <= (rec.uncertainty ?? 0) ? 'yes' : 'no'}</span></div>
                <div className="metric"><span>Pipeline time</span><span className="mono">{r.executionTimeMs} ms (real)</span></div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {replay != null && (
        <div className="lab-replay" role="status">
          {STAGES.map((n, i) => (
            <span key={n} className={i === replay ? 'is-on' : i < replay ? 'is-done' : ''}>{String(i * 80).padStart(3, '0')} ms · {n}</span>
          ))}
          <em>conceptual timeline — not measured timings</em>
        </div>
      )}

      {/* ---------------- Sweeps ---------------- */}
      <section className="card">
        <div className="card__head">
          <span className="card__title">Parameter sweep</span>
          <span className="card__sub">each point = 6 seeded pipeline runs around the current configuration</span>
        </div>
        <div className="card__body stack" style={{ gap: 12 }}>
          <div className="lab-row">
            <select className="select" aria-label="Sweep parameter" value={sweepKey} onChange={(e) => setSweepKey(e.target.value as SweepKey)}>
              {SWEEPS.map((w) => <option key={w.key} value={w.key}>{w.label}</option>)}
            </select>
            <button type="button" className="btn btn--primary btn--sm" onClick={doSweep}><Play size={14} aria-hidden="true" /> Run sweep</button>
            {sweep && <span className="card__sub">{sweep.points.reduce((a, p) => a + p.runs, 0)} pipeline runs · {sweep.ms} ms</span>}
          </div>
          {sweep && <SweepView sweep={sweep} />}
        </div>
      </section>

      {/* ---------------- Wavelength calibration ---------------- */}
      <section className="card">
        <div className="card__head">
          <span className="card__title">Wavelength calibration λ = a·p + b</span>
          <span className="card__sub">CFL lines on the simulated sensor → production least-squares fit</span>
        </div>
        <div className="card__body lab-two">
          <div className="stack" style={{ gap: 12 }}>
            <Slider id="w-noise" label="Peak-pick noise" value={wc.pixelNoise} min={0} max={8} step={0.25} fmt={(v) => `σ ${v} px`} onChange={(v) => setWc({ ...wc, pixelNoise: v })} />
            <Slider id="w-shift" label="Spectrum moved after calibration" value={wc.shiftPx} min={-20} max={20} step={1} fmt={(v) => `${v} px`} onChange={(v) => setWc({ ...wc, shiftPx: v })} />
            <Segmented<string> label="Missing reference line" value={wc.dropLine ?? 'none'} onChange={(v) => setWc({ ...wc, dropLine: v === 'none' ? null : v })}
              options={[{ value: 'none', label: 'All lines' }, ...CFL_REFERENCE_LINES.map((l) => ({ value: l.name, label: `no ${l.trueNm.toFixed(0)}` }))]} />
          </div>
          <div>
            <table className="lab-table">
              <thead><tr><th>Line</th><th>λ true</th><th>pixel</th><th>λ fit</th><th>residual</th></tr></thead>
              <tbody>
                {wcal.fit.referenceLines.map((l) => (
                  <tr key={l.name}><td>{l.name}</td><td className="mono">{l.trueNm.toFixed(2)}</td><td className="mono">{l.pixel.toFixed(1)}</td>
                    <td className="mono">{l.fittedNm.toFixed(2)}</td><td className="mono">{(l.trueNm - l.fittedNm).toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="metrics">
              <div className="metric"><span>Fit</span><span className="mono">{wcal.fit.isValid ? `λ = ${wcal.fit.slope.toFixed(4)}·p + ${wcal.fit.intercept.toFixed(2)}` : wcal.fit.errorCode}</span></div>
              <div className="metric"><span>R² · residual RMS</span><span className="mono">{wcal.fit.r2 ?? '—'} · {wcal.fit.residualRms ?? '—'} nm</span></div>
              <div className="metric"><span>Worst error 400–700 nm</span><span className="mono">{wcal.maxErrNm == null ? '—' : `${wcal.maxErrNm.toFixed(2)} nm`}</span></div>
            </div>
          </div>
        </div>
      </section>

      <p className="twin-disclaimer">
        Physically grounded simulation. LED, chromophore, scatter, stray-light, kinetics and sensor models are documented
        approximations (see LISA_SIMULATION_SYSTEM.md); kinetic rate constants and interferent spectra are illustrative, not
        measured. Every number is produced by LISA’s production simulator and inference pipeline — none is experimental data.
      </p>
    </div>
  );
};

const SweepView: React.FC<{ sweep: { key: SweepKey; points: SweepPoint[] } }> = ({ sweep }) => {
  const def = SWEEPS.find((w) => w.key === sweep.key)!;
  const categorical = typeof sweep.points[0].x === 'string';
  const xs = sweep.points.map((p, i) => (categorical ? i : (p.x as number)));
  const vals = sweep.points.flatMap((p) => [p.meanPredicted, p.truth, (p.meanPredicted ?? 0) + (p.sdPredicted ?? 0)]).filter((v): v is number => v != null);
  const yMax = Math.max(0.2, ...vals) * 1.1;
  const xFmt = (v: number) => (categorical ? String(sweep.points[v]?.x).replace(/^device-\w-/, '') : String(v));
  return (
    <div className="lab-two">
      <div>
        <Plot label="Predicted concentration across sweep" x={xs} y={[0, yMax]} xLabel={`${def.label} ${def.unit}`} yLabel="mg/L" xFmt={xFmt}
          xTicks={categorical ? xs : undefined}
          errors={sweep.points.flatMap((p, i) => (p.meanPredicted != null && p.sdPredicted != null ? [{ x: xs[i], lo: p.meanPredicted - p.sdPredicted, hi: p.meanPredicted + p.sdPredicted }] : []))}
          series={[{ y: sweep.points.map((p) => p.truth), cls: 's-true' }, { y: sweep.points.map((p) => p.meanPredicted), cls: 's-meas' }]} />
        <div className="lab-keys"><Key cls="s-meas">mean prediction ± 1 sd (accepted runs)</Key><Key cls="s-true">simulated truth</Key></div>
      </div>
      <table className="lab-table">
        <thead><tr><th>{def.label}</th><th>mean</th><th>|err|</th><th>± unc</th><th>covered</th><th>rejected</th></tr></thead>
        <tbody>
          {sweep.points.map((p, i) => (
            <tr key={i}>
              <td className="mono">{xFmt(xs[i])}</td><td className="mono">{f3(p.meanPredicted)}</td><td className="mono">{f3(p.meanAbsError)}</td>
              <td className="mono">{f3(p.meanUncertainty)}</td><td className="mono">{p.coverage == null ? '—' : `${Math.round(p.coverage * 100)} %`}</td>
              <td className="mono">{Math.round(p.rejectedFraction * 100)} %</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SimulationLab;
