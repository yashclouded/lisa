// LISA Digital Twin — page.
// Controls → simulator params → production simulator → production pipeline →
// what you see. The 3D scene, the sensor strip, the plots and the result are
// all views of one TwinMeasurement; nothing here computes chemistry.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Lightbulb, Pause, Play, SkipForward, X, RotateCcw } from 'lucide-react';
import { SimulationParams } from '../engine/simulator';
import { computeAbsorbance } from '../engine/absorbance';
import { DEMO_DEVICES } from '../engine/deviceCalibration';
import { STANDARD_WAVELENGTHS } from '../engine/spectrum';
import { SpectrumViewer } from '../components/SpectrumViewer';
import { Segmented } from '../components/ui/Segmented';
import { Disclosure } from '../components/ui/Disclosure';
import { StatusPill, QC_TONE, QC_WORD, VERDICT_TONE, Tone } from '../components/ui/Status';
import { TwinScene, PartId, ModeId, ViewId, PART_NAMES } from './TwinScene';
import { deg, fmt, MODEL_NAME, analyteOf, peakIndex, isRefused, displayAbsorbance, partInfo } from './twinInfo';
import {
  SCENARIOS,
  FAULTS,
  FaultId,
  applyFaults,
  runTwinMeasurement,
  TwinMeasurement,
  transmittedColor,
  drawSensorFrame,
  pixelOfWavelength,
  SENSOR_CALIBRATION,
  CHEMISTRIES,
  chemistryOf,
  SENSOR_COLUMNS,
  GRATING_LINES_PER_MM,
  WEDGE_ANGLE_RAD,
} from './twinModel';
import { heroById } from '../simulation/scenarios';
import type { SimulationConfig } from '../simulation/state';
import './digitalTwin.css';

// Deterministic, recordable entry points: #/twin?scene=result&cinema=1, #/twin?hero=HERO_TURBID
const CINEMA_SCENES = {
  device: 0, explode: 1, led: 2, cuvette: 3, slit: 4, grating: 5, camera: 6,
  optics: 7, dispersion: 8, sensor: 9, spectrum: 10, compute: 11, result: 12, unknown: 13, rejection: 14,
} as const;
const query = () => new URLSearchParams(window.location.hash.split('?')[1] ?? '');

const CHEM_NAME = { phosphate: 'Molybdenum blue', lead: 'Pb–dithizone', anomaly: 'Unknown dye', iron: 'Fe–phenanthroline' } as const;

// ---------------------------------------------------------------------------
// Pipeline stages, each with a value read from the actual measurement.
// ---------------------------------------------------------------------------

const STAGES: { name: string; value: (m: TwinMeasurement) => string }[] = [
  { name: 'Light', value: () => 'White LED' },
  {
    name: 'Chemistry',
    value: (m) => CHEM_NAME[m.params.analyte],
  },
  {
    name: 'Optics',
    value: (m) => {
      const k = peakIndex(m);
      return `T at ${400 + 2 * k} nm ${Math.round((100 * m.sim.sampleIntensities[k]) / m.sim.blankIntensities[k])}%`;
    },
  },
  { name: 'Dispersion', value: () => `${GRATING_LINES_PER_MM} l/mm` },
  { name: 'Sensor', value: (m) => `peak ${Math.max(...m.sim.sampleIntensities).toFixed(0)}/255` },
  {
    name: 'Compute',
    value: (m) => (isRefused(m) ? 'Not run' : `shift ${m.result.shiftPx > 0 ? '+' : ''}${m.result.shiftPx} px`),
  },
  { name: 'Inference', value: (m) => (isRefused(m) ? 'No calibration' : MODEL_NAME[m.result.record.selectedModel]) },
  {
    name: 'Validation',
    value: (m) =>
      isRefused(m) ? 'Uncalibrated analyte' : `QC ${QC_WORD[m.result.qc.overallStatus]} · OOD ${m.result.ood.score}`,
  },
  {
    name: 'Result',
    value: (m) =>
      m.result.record.isRejected ? 'Rejected' : `${fmt(m.result.record.concentration)} ${m.result.record.unit}`,
  },
];

// ---------------------------------------------------------------------------
// Jury mode — a rehearsable 75-second story.
// ---------------------------------------------------------------------------

interface JuryStep {
  title: string;
  ms: number;
  caption: (m: TwinMeasurement, busy: boolean) => string;
}

const resultCaption = (m: TwinMeasurement, busy: boolean) => {
  if (busy) return 'Running the production LISA pipeline…';
  const r = m.result.record;
  if (r.isRejected) return `${r.rejectionReason ?? 'Measurement rejected.'}`;
  const truth = m.params.analyte === 'phosphate' ? `Simulated truth ${m.params.concentration.toFixed(2)} mg P/L → ` : '';
  return `${truth}LISA reports ${fmt(r.concentration)} ± ${fmt(r.uncertainty)} ${r.unit}. QC ${QC_WORD[m.result.qc.overallStatus].toLowerCase()}, ${m.result.ood.status.replace(/_/g, ' ').toLowerCase()}.`;
};

const JURY: JuryStep[] = [
  { title: 'The device', ms: 5000, caption: () => 'LISA: a folded black-card spectrometer that clips onto a phone. Everything on this page is a simulation of that device.' },
  { title: 'Exploded view', ms: 5000, caption: () => 'The optical train separates along the light path: LED, diffuser, cuvette, slit, grating, camera.' },
  { title: 'White LED', ms: 3500, caption: () => 'A white LED provides broadband illumination across 400–700 nm.' },
  { title: 'Sample cuvette', ms: 3500, caption: () => '10 mm cuvette holding the molybdenum-blue reacted sample — the path length l in Beer–Lambert.' },
  { title: 'Slit', ms: 3500, caption: () => 'Two razor blades 0.1–0.2 mm apart make a line source, so each wavelength images to one column.' },
  { title: 'Diffraction grating', ms: 3500, caption: () => '1000 lines/mm film on the lens sends each wavelength to its own angle.' },
  { title: 'Phone camera', ms: 3500, caption: () => 'The phone is detector and computer. A 33.4° wedge centres 550 nm on the sensor.' },
  { title: 'Light on', ms: 6000, caption: () => 'Molybdenum blue absorbs red, so the light leaving the cuvette is tinted — computed from the simulated transmission.' },
  { title: 'Dispersion', ms: 6000, caption: () => 'The grating fans the light out by wavelength. Each ray’s strength is the simulated intensity at that wavelength.' },
  { title: 'Sensor', ms: 6000, caption: () => 'Seen through the phone: the spectrum lands across the sensor, dimmed in the red where the sample absorbs.' },
  { title: 'Spectrum', ms: 6500, caption: () => 'The same array becomes I(λ), then A(λ) = −log₁₀(I / I₀). The 630–690 nm band carries the phosphate signal.' },
  { title: 'Compute', ms: 6000, caption: resultCaption },
  { title: 'Result', ms: 6000, caption: resultCaption },
  { title: 'Unknown chemistry', ms: 6000, caption: () => 'Same device, same code. The cuvette now holds a yellow dye LISA was never calibrated for.' },
  { title: 'Rejected', ms: 8000, caption: resultCaption },
];

// ---------------------------------------------------------------------------
// Small plots — drawn straight from arrays in the measurement.
// ---------------------------------------------------------------------------

const Spark: React.FC<{
  series: { values: number[]; className: string }[];
  max: number;
  band?: [number, number];
  label: string;
}> = ({ series, max, band, label }) => {
  const x = (i: number) => (i / (STANDARD_WAVELENGTHS.length - 1)) * 300;
  const y = (v: number) => 96 - (Math.max(0, Math.min(max, v)) / max) * 90;
  const bx = (nm: number) => ((nm - 400) / 300) * 300;
  return (
    <svg className="twin-spark" viewBox="0 0 300 100" preserveAspectRatio="none" role="img" aria-label={label}>
      {band && <rect x={bx(band[0])} y={0} width={bx(band[1]) - bx(band[0])} height={100} className="twin-spark__band" />}
      {series.map((s, k) => (
        <path
          key={k}
          className={s.className}
          vectorEffect="non-scaling-stroke"
          d={`M ${s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' L ')}`}
        />
      ))}
    </svg>
  );
};

const SensorStrip: React.FC<{ intensities: number[] }> = ({ intensities }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawSensorFrame(ref.current, intensities);
  }, [intensities]);
  return (
    <div className="twin-strip">
      <canvas ref={ref} width={600} height={44} aria-label="Simulated sensor row" />
      <div className="twin-strip__ticks" aria-hidden="true">
        {[450, 500, 550, 600, 650, 700].map((nm) => (
          <span key={nm} style={{ left: `${(pixelOfWavelength(nm) / (SENSOR_COLUMNS - 1)) * 100}%` }}>
            {nm}
          </span>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------

const DigitalTwin: React.FC = () => {
  // Simulation inputs
  const [q] = useState(query);
  // A hero scenario or a lab config opens the *same* measurement (same seed) in 3D.
  const [origin] = useState<SimulationConfig | null>(() => {
    const hero = heroById(q.get('hero') ?? '');
    if (hero) return hero.config;
    try {
      return q.get('cfg') ? (JSON.parse(q.get('cfg')!) as SimulationConfig) : null;
    } catch {
      return null;
    }
  });
  const hero = heroById(origin?.id ?? '');
  const [base, setBase] = useState<SimulationParams>(() => {
    if (!origin) return SCENARIOS[0].params;
    const { seed: _s, deviceId: _d, id: _i, declaredAnalyteId: _a, ...p } = origin;
    return p;
  });
  const [deviceId, setDeviceId] = useState(origin?.deviceId ?? SCENARIOS[0].deviceId);
  const [scenarioId, setScenarioId] = useState<string | null>(origin ? null : SCENARIOS[0].id);
  const cinema = q.get('cinema') === '1';
  const [faults, setFaults] = useState<FaultId[]>([]);
  const [run, setRun] = useState(1);
  const [stage, setStage] = useState<number | null>(null);

  // Presentation
  const [mode, setMode] = useState<ModeId>('normal');
  const [view, setView] = useState<ViewId>('hero');
  const [lightOn, setLightOn] = useState(false);
  const [showSample, setShowSample] = useState(true);
  const [selected, setSelected] = useState<PartId | null>(null);
  const [jury, setJury] = useState<{ step: number; paused: boolean } | null>(null);

  const params = useMemo(() => applyFaults(base, faults), [base, faults]);
  const m = useMemo(() => runTwinMeasurement(params, deviceId, run, origin ?? undefined), [params, deviceId, run, origin]);
  const r = m.result;
  const busy = stage !== null && stage < 8;

  // ---- Scene lifecycle -----------------------------------------------------
  const stageEl = useRef<HTMLDivElement>(null);
  const scene = useRef<TwinScene | null>(null);
  const webglFailed = !('WebGL2RenderingContext' in window);

  useEffect(() => {
    try {
      scene.current = new TwinScene(stageEl.current!, setSelected, () => setView('free'));
    } catch (err) {
      console.warn('Digital twin: WebGL unavailable', err);
    }
    return () => {
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);

  useEffect(() => scene.current?.setMode(mode), [mode]);
  useEffect(() => scene.current?.setView(view), [view]);
  useEffect(() => scene.current?.setSelected(selected), [selected]);

  const transmitted = useMemo(
    () => transmittedColor(m.sim.blankIntensities, m.sim.sampleIntensities).rgb,
    [m]
  );
  const sensorIntensities = showSample ? m.sim.sampleIntensities : m.sim.blankIntensities;

  useEffect(() => {
    scene.current?.setOptics({ lightOn, reveal: stage ?? 9, sensorIntensities, transmitted, showSample });
  }, [lightOn, stage, sensorIntensities, transmitted, showSample]);

  useEffect(() => {
    const rec = r.record;
    scene.current?.setScreen(
      busy
        ? { id: m.id, headline: 'Measuring…', sub: STAGES[stage!].name, tone: 'neutral' }
        : rec.isRejected
          ? { id: m.id, headline: 'No result', sub: 'Measurement rejected', tone: 'alert' }
          : {
              id: m.id,
              headline: `${fmt(rec.concentration)} ${rec.unit}`,
              sub: `± ${fmt(rec.uncertainty)} · QC ${QC_WORD[r.qc.overallStatus]}`,
              tone: VERDICT_TONE[rec.verdict] === 'alert' ? 'alert' : 'pass',
            }
    );
  }, [m, r, busy, stage]);

  // ---- Measurement run (staged reveal of a result computed by the engine) --
  const startRun = useCallback(() => {
    setRun((n) => n + 1);
    setLightOn(true);
    setMode((md) => (md === 'normal' ? 'cutaway' : md));
    setStage(0);
  }, []);

  useEffect(() => {
    if (stage === null) return;
    const t = window.setTimeout(() => setStage(stage >= 8 ? null : stage + 1), stage >= 8 ? 900 : 520);
    return () => window.clearTimeout(t);
  }, [stage]);

  // ---- Controls ------------------------------------------------------------
  const setParam = <K extends keyof SimulationParams>(key: K, value: SimulationParams[K]) => {
    setBase((p) => ({ ...p, [key]: value }));
    setScenarioId(null);
  };
  const loadScenario = (id: string) => {
    const s = SCENARIOS.find((x) => x.id === id)!;
    setBase({ ...s.params });
    setDeviceId(s.deviceId);
    setFaults([]);
    setScenarioId(id);
  };
  const toggleFault = (id: FaultId) =>
    setFaults((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  // ---- Jury mode -------------------------------------------------------------
  const photonRef = useRef<HTMLElement>(null);
  const juryEnter = (step: number) => {
    const pick = (p: PartId | null) => setSelected(p);
    switch (step) {
      case 0:
        loadScenario('clean_phosphate');
        setMode('normal');
        setView('hero');
        setLightOn(false);
        setShowSample(true);
        setStage(null);
        pick(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 1:
        setMode('exploded');
        setView('hero');
        break;
      case 2:
        pick('led');
        break;
      case 3:
        pick('cuvette');
        break;
      case 4:
        pick('slit');
        break;
      case 5:
        pick('grating');
        break;
      case 6:
        pick('phone');
        break;
      case 7:
        pick(null);
        setMode('cutaway');
        setView('optical');
        setLightOn(true);
        break;
      case 8:
        setMode('exploded');
        setView('optical');
        pick('grating');
        break;
      case 9:
        pick(null);
        setView('sensor');
        break;
      case 10:
        setView('hero');
        photonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      case 11:
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setMode('cutaway');
        startRun();
        break;
      case 13:
        setFaults(['dye']);
        setScenarioId(null);
        startRun();
        break;
    }
  };

  useEffect(() => {
    if (jury) juryEnter(jury.step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jury?.step]);

  useEffect(() => {
    if (!jury || jury.paused) return;
    const last = jury.step >= JURY.length - 1;
    const t = window.setTimeout(
      () => setJury((j) => (j ? (last ? { ...j, paused: true } : { step: j.step + 1, paused: false }) : j)),
      JURY[jury.step].ms
    );
    return () => window.clearTimeout(t);
  }, [jury]);

  // Scene URL: replay the jury steps up to the requested one so the state is
  // exactly what the story would have produced, then hold there (paused).
  // Guarded so StrictMode's double effect run cannot advance the seed twice.
  const sceneEntered = useRef(false);
  useEffect(() => {
    if (sceneEntered.current) return;
    sceneEntered.current = true;
    const scene = q.get('scene') as keyof typeof CINEMA_SCENES | null;
    const autoplay = q.get('autoplay') === '1';
    if (scene && scene in CINEMA_SCENES) {
      const n = CINEMA_SCENES[scene];
      for (let i = 0; i < n; i++) juryEnter(i);
      setStage(null);
      setJury({ step: n, paused: !autoplay });
    } else if (autoplay) setJury({ step: 0, paused: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!jury) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setJury(null);
      if (e.key === ' ' && (e.target as HTMLElement).tagName !== 'BUTTON') {
        e.preventDefault();
        setJury((j) => (j ? { ...j, paused: !j.paused } : j));
      }
      if (e.key === 'ArrowRight') setJury((j) => (j && j.step < JURY.length - 1 ? { step: j.step + 1, paused: true } : j));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [jury]);

  // ---- Derived display values ----------------------------------------------
  const rec = r.record;
  const analyte = analyteOf(m);
  const chem = chemistryOf(base.analyte);
  const refused = isRefused(m);
  const absDisplay = displayAbsorbance(m);
  const PEAK_IDX = peakIndex(m);
  const truth = params.analyte === analyte.id ? params.concentration : null;
  const errorPct =
    truth && rec.concentration != null ? (Math.abs(rec.concentration - truth) / truth) * 100 : null;
  const iS = r.alignedProfile[PEAK_IDX];
  const iB = m.sim.blankIntensities[PEAK_IDX];
  const rawA = computeAbsorbance([iS], [iB])[0];
  const peakNm = STANDARD_WAVELENGTHS[absDisplay.indexOf(Math.max(...absDisplay))];
  const device = DEMO_DEVICES.find((d) => d.id === deviceId)!;
  const info = selected ? partInfo(selected, m) : null;
  const oodTone: Tone = r.ood.status === 'IN_DISTRIBUTION' ? 'pass' : r.ood.status === 'BORDERLINE' ? 'caution' : 'alert';
  const absMax = Math.max(refused ? 0.2 : 1.0, ...absDisplay) * 1.1;

  return (
    <div className={`twin${cinema ? ' twin--cinema' : ''}`}>
      <header className="twin-bar">
        <a className="btn btn--ghost btn--sm" href="#/">
          <ArrowLeft size={15} aria-hidden="true" /> Instrument
        </a>
        <div className="twin-bar__title">
          <span className="brand__mark">LISA</span>
          <span className="twin-bar__name">Digital twin</span>
          <StatusPill tone="caution">Simulated</StatusPill>
        </div>
        {origin && <span className="card__sub">{hero ? hero.label : 'From simulation lab'} · seed {m.seed}</span>}
        <div className="twin-bar__spacer" />
        <a className="btn btn--ghost btn--sm" href="#/lab">
          Simulation lab
        </a>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={() => setJury({ step: 0, paused: false })}
        >
          <Play size={14} aria-hidden="true" /> Jury mode
        </button>
      </header>

      <div className="twin-main">
        {/* ---------------- 3D stage ---------------- */}
        <section className="twin-stage" aria-label="3D model of the LISA instrument">
          <div ref={stageEl} className="twin-stage__gl" />
          {webglFailed && (
            <div className="twin-stage__fallback">
              WebGL is not available in this browser, so the 3D model cannot render. The simulation, plots and
              result below still run on the production pipeline.
            </div>
          )}

          <div className="twin-stage__top">
            <Segmented<ModeId>
              label="Model display"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'normal', label: 'Assembled' },
                { value: 'cutaway', label: 'Cutaway' },
                { value: 'exploded', label: 'Exploded' },
              ]}
            />
            <Segmented<ViewId>
              label="Camera"
              value={view}
              onChange={setView}
              options={[
                { value: 'front', label: 'Front' },
                { value: 'top', label: 'Top' },
                { value: 'side', label: 'Side' },
                { value: 'optical', label: 'Optical path' },
                { value: 'sensor', label: 'Sensor', title: 'See through the phone' },
              ]}
            />
          </div>

          {info && selected && (
            <div className="twin-inspect" role="region" aria-label={PART_NAMES[selected]}>
              <div className="twin-inspect__head">
                <span className="twin-inspect__title">{PART_NAMES[selected]}</span>
                <button type="button" className="btn btn--ghost btn--icon" aria-label="Close" onClick={() => setSelected(null)}>
                  <X size={14} />
                </button>
              </div>
              <p className="twin-inspect__short">{info.short}</p>
              <Disclosure label="Technical details">
                <ul className="twin-inspect__list">
                  {info.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </Disclosure>
            </div>
          )}

          {lightOn && !info && (
            <div className="twin-readout" aria-hidden="true">
              <span className="mono twin-readout__id">{m.id} · simulated</span>
              {busy ? (
                <span className="twin-readout__value twin-result__value--muted">{STAGES[stage!].name}…</span>
              ) : rec.isRejected ? (
                <span className="twin-readout__value twin-result__value--rejected">No result · rejected</span>
              ) : (
                <span className="twin-readout__value mono">
                  {fmt(rec.concentration)} <span className="twin-result__unit">± {fmt(rec.uncertainty)} {rec.unit}</span>
                </span>
              )}
            </div>
          )}

          <div className="twin-stage__bottom">
            <span className="twin-stage__hint">Drag to rotate · scroll to zoom · click a part</span>
            <div className="twin-stage__actions">
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                aria-pressed={lightOn}
                onClick={() => setLightOn((v) => !v)}
              >
                <Lightbulb size={14} aria-hidden="true" /> {lightOn ? 'Light on' : 'Light off'}
              </button>
              <button type="button" className="btn btn--primary btn--sm" onClick={startRun} disabled={busy}>
                <Play size={14} aria-hidden="true" /> {busy ? 'Measuring…' : 'Run measurement'}
              </button>
            </div>
          </div>
        </section>

        {/* ---------------- Side rail ---------------- */}
        <aside className="twin-side">
          <section className="card twin-result" aria-live="polite">
            <div className="card__head">
              <span className="card__title mono">{m.id}</span>
              <span className="card__sub">seed {m.seed}</span>
            </div>
            <div className="card__body">
              <div>
                <div className="twin-result__analyte">{analyte.name}</div>
                {busy ? (
                  <div className="twin-result__value twin-result__value--muted">
                    {STAGES[stage!].name}…
                  </div>
                ) : rec.isRejected ? (
                  <div className="twin-result__value twin-result__value--rejected">No result</div>
                ) : (
                  <div className="twin-result__value">
                    {fmt(rec.concentration)}
                    <span className="twin-result__unit"> {rec.unit}</span>
                  </div>
                )}
                {!busy && !rec.isRejected && (
                  <div className="twin-result__ci tnum">± {fmt(rec.uncertainty)} {rec.unit} (engine uncertainty)</div>
                )}
              </div>

              {!busy && (
                <div className="twin-result__pills">
                  <StatusPill tone={VERDICT_TONE[rec.verdict]}>
                    {rec.isRejected ? 'Measurement rejected' : rec.verdictLabel.replace(': ', ' · ')}
                  </StatusPill>
                  <StatusPill tone={QC_TONE[r.qc.overallStatus]}>QC {QC_WORD[r.qc.overallStatus]}</StatusPill>
                  <StatusPill tone={oodTone}>
                    {r.ood.status === 'IN_DISTRIBUTION' ? 'In distribution' : r.ood.status === 'BORDERLINE' ? 'Borderline' : 'Out of distribution'}
                  </StatusPill>
                </div>
              )}

              {!busy && rec.isRejected && (
                <div className="callout callout--alert">{rec.rejectionReason}</div>
              )}

              <div className="metrics">
                <div className="metric">
                  <span>Simulated truth</span>
                  <span className="mono">{truth == null ? `not ${analyte.name.split(' ')[0].toLowerCase()} (unknown dye)` : `${truth.toFixed(3)} ${analyte.unit}`}</span>
                </div>
                <div className="metric">
                  <span>Error vs truth</span>
                  <span className="mono">{busy || errorPct == null ? '—' : `${errorPct.toFixed(1)} %`}</span>
                </div>
                <div className="metric">
                  <span>Model</span>
                  <span>{MODEL_NAME[rec.selectedModel]}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card__head">
              <span className="card__title">Simulation controls</span>
            </div>
            <div className="card__body">
              <div className="twin-chips" role="group" aria-label="Preset scenarios">
                {SCENARIOS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="twin-chip"
                    aria-pressed={scenarioId === s.id}
                    title={s.description}
                    onClick={() => loadScenario(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="field">
                <span className="field__label">Chemistry in the cuvette</span>
                <Segmented<(typeof CHEMISTRIES)[number]['id']>
                  label="Chemistry in the cuvette"
                  block
                  value={chem.id}
                  onChange={(id) => {
                    const next = chemistryOf(id);
                    setBase((p) => ({ ...p, analyte: id, concentration: Math.min(p.concentration, next.max) }));
                    setScenarioId(null);
                  }}
                  options={CHEMISTRIES.map((c) => ({ value: c.id, label: c.label }))}
                />
                {chem.id === 'lead' && (
                  <p className="field__hint">
                    Pb–dithizone absorbs ≈0.33 AU per mg/L at 520 nm. At the 0.01 mg/L drinking-water limit
                    that is ≈0.003 AU — below the noise floor without pre-concentration. LISA uses a simulated
                    lead calibration model (research mode).
                  </p>
                )}
              </div>

              <div className="field">
                <div className="field__label">
                  <label htmlFor="tw-conc">{chem.label} concentration</label>
                  <span className="field__value mono">
                    {base.concentration.toFixed(chem.step < 0.01 ? 3 : 2)} {chem.unit}
                  </span>
                </div>
                <input
                  id="tw-conc"
                  type="range"
                  className="slider"
                  min={0}
                  max={chem.max}
                  step={chem.step}
                  value={base.concentration}
                  onChange={(e) => setParam('concentration', +e.target.value)}
                />
                <div className="slider-scale">
                  <span>0.00</span>
                  <span>{chem.mark}</span>
                  <span>{chem.max.toFixed(2)}</span>
                </div>
              </div>

              <div className="twin-grid2">
                <div className="field">
                  <div className="field__label">
                    <label htmlFor="tw-noise">Noise</label>
                    <span className="field__value mono">{base.noiseLevel.toFixed(3)}</span>
                  </div>
                  <input id="tw-noise" type="range" className="slider" min={0} max={0.3} step={0.005} value={base.noiseLevel} onChange={(e) => setParam('noiseLevel', +e.target.value)} />
                </div>
                <div className="field">
                  <div className="field__label">
                    <label htmlFor="tw-shift">Cuvette shift</label>
                    <span className="field__value mono">{base.shiftPx > 0 ? '+' : ''}{base.shiftPx} px</span>
                  </div>
                  <input id="tw-shift" type="range" className="slider" min={-10} max={10} step={1} value={base.shiftPx} onChange={(e) => setParam('shiftPx', +e.target.value)} />
                </div>
                <div className="field">
                  <div className="field__label">
                    <label htmlFor="tw-turb">Turbidity</label>
                    <span className="field__value mono">{base.turbidityAU.toFixed(2)} AU</span>
                  </div>
                  <input id="tw-turb" type="range" className="slider" min={0} max={0.8} step={0.02} value={base.turbidityAU} onChange={(e) => setParam('turbidityAU', +e.target.value)} />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="tw-device">Device profile</label>
                  <select
                    id="tw-device"
                    className="select select--block"
                    value={deviceId}
                    onChange={(e) => {
                      setDeviceId(e.target.value);
                      setScenarioId(null);
                    }}
                  >
                    {DEMO_DEVICES.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name.replace(/ \(.*\)/, '')} — {d.colorTemperatureBias}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Disclosure label="Advanced">
                <div className="stack" style={{ gap: 14 }}>
                  <div className="field">
                    <div className="field__label">
                      <label htmlFor="tw-humic">Humic colour background</label>
                      <span className="field__value mono">{base.colorInterferenceAU.toFixed(2)} AU</span>
                    </div>
                    <input id="tw-humic" type="range" className="slider" min={0} max={0.6} step={0.02} value={base.colorInterferenceAU} onChange={(e) => setParam('colorInterferenceAU', +e.target.value)} />
                  </div>
                  <div className="field">
                    <div className="field__label">
                      <label htmlFor="tw-drift">Illumination drift</label>
                      <span className="field__value mono">{(base.illuminationDrift * 100).toFixed(0)} %</span>
                    </div>
                    <input id="tw-drift" type="range" className="slider" min={-0.2} max={0.2} step={0.01} value={base.illuminationDrift} onChange={(e) => setParam('illuminationDrift', +e.target.value)} />
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={base.isSaturated} onChange={(e) => setParam('isSaturated', e.target.checked)} />
                    <span className="switch__track" aria-hidden="true" />
                    <span>Saturate sensor</span>
                  </label>
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => setRun((n) => n + 1)}>
                    <RotateCcw size={14} aria-hidden="true" /> New noise realisation
                  </button>
                </div>
              </Disclosure>
            </div>
          </section>

          <section className="card">
            <div className="card__head">
              <span className="card__title">Break the measurement</span>
              {faults.length > 0 && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setFaults([])}>
                  Clear
                </button>
              )}
            </div>
            <div className="card__body">
              <div className="twin-chips" role="group" aria-label="Inject faults">
                {FAULTS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="twin-chip twin-chip--fault"
                    aria-pressed={faults.includes(f.id)}
                    onClick={() => toggleFault(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <p className="field__hint">
                Faults change the simulated optics only. Whether LISA rejects is decided by the unchanged QC and
                OOD checks — some faults are caught, some are not.
              </p>
            </div>
          </section>
        </aside>
      </div>

      {/* ---------------- Pipeline chain ---------------- */}
      <ol className="twin-chain" aria-label="Measurement chain">
        {STAGES.map((s, i) => {
          const state = stage === null || i < stage ? 'done' : i === stage ? 'active' : 'pending';
          return (
            <li key={s.name} className={`twin-chain__step is-${state}`}>
              <span className="twin-chain__num mono">{String(i + 1).padStart(2, '0')}</span>
              <span className="twin-chain__name">{s.name}</span>
              <span className="twin-chain__value">{state === 'pending' ? '…' : s.value(m)}</span>
            </li>
          );
        })}
      </ol>

      {/* ---------------- Photon → number ---------------- */}
      <section ref={photonRef} className="twin-p2n" aria-label="From photon to number">
        <div className="twin-p2n__head">
          <h2 className="twin-h2">From photon to number</h2>
          <span className="card__sub mono">{m.id}</span>
          <div className="twin-bar__spacer" />
          <Segmented<'blank' | 'sample'>
            label="Cuvette content"
            value={showSample ? 'sample' : 'blank'}
            onChange={(v) => setShowSample(v === 'sample')}
            options={[
              { value: 'blank', label: 'Blank  I₀' },
              { value: 'sample', label: 'Sample  I' },
            ]}
          />
        </div>

        <div className="twin-p2n__row">
          <div className="twin-tile">
            <div className="twin-tile__title">1 · Camera sensor</div>
            <SensorStrip intensities={sensorIntensities} />
            <p className="twin-tile__note">
              {showSample ? 'Sample' : 'Blank'} row, placed by the grating equation.{' '}
              <span className="formula">
                λ(p) = {SENSOR_CALIBRATION.slope.toFixed(3)}·p + {SENSOR_CALIBRATION.intercept.toFixed(1)}
              </span>
            </p>
          </div>

          <div className="twin-tile">
            <div className="twin-tile__title">2 · Transmission I(λ)</div>
            <Spark
              label="Blank and sample intensity"
              max={260}
              series={[
                { values: m.sim.blankIntensities, className: `twin-spark__blank${showSample ? '' : ' is-on'}` },
                { values: r.alignedProfile, className: `twin-spark__sample${showSample ? ' is-on' : ''}` },
              ]}
            />
            <p className="twin-tile__note">
              <span className="twin-key twin-key--blank" /> I₀ blank <span className="twin-key twin-key--sample" /> I sample (aligned)
            </p>
          </div>

          <div className="twin-tile">
            <div className="twin-tile__title">3 · Absorbance A(λ)</div>
            <Spark
              label="Absorbance spectrum"
              max={absMax}
              band={analyte.primaryBand}
              series={[{ values: absDisplay, className: 'twin-spark__abs' }]}
            />
            <p className="twin-tile__note">
              <span className="formula">A = −log₁₀(I / I₀)</span> at {STANDARD_WAVELENGTHS[PEAK_IDX]} nm: −log₁₀({iS.toFixed(1)} / {iB.toFixed(1)}) ={' '}
              <b className="mono">{rawA.toFixed(3)}</b>
              {refused ? (
                <> AU. Raw — the pipeline refused this uncalibrated analyte before baseline correction.</>
              ) : (
                <>, baseline-corrected <b className="mono">{fmt(r.absorbances[PEAK_IDX])}</b> AU</>
              )}
            </p>
          </div>

          <div className="twin-tile twin-tile--result">
            <div className="twin-tile__title">4 · Model → result</div>
            <div className="twin-tile__model">{MODEL_NAME[rec.selectedModel]}</div>
            {busy ? (
              <div className="twin-tile__big twin-result__value--muted">…</div>
            ) : rec.isRejected ? (
              <div className="twin-tile__big twin-result__value--rejected">Rejected</div>
            ) : (
              <div className="twin-tile__big mono">
                {fmt(rec.concentration)} <span className="twin-result__unit">{rec.unit}</span>
              </div>
            )}
            <p className="twin-tile__note">
              {rec.isRejected ? (refused ? 'Uncalibrated analyte — the pipeline refused before inference.' : 'Prediction withheld by QC / OOD.') : `± ${fmt(rec.uncertainty)} · QC ${QC_WORD[r.qc.overallStatus]} · OOD ${r.ood.score}`}
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- Full spectrum + technical view ---------------- */}
      <section className="twin-lower">
        <SpectrumViewer
          wavelengths={rec.wavelengths}
          absorbances={absDisplay}
          rawIntensities={r.alignedProfile}
          blankIntensities={m.sim.blankIntensities}
          bandStartNm={analyte.primaryBand[0]}
          bandEndNm={analyte.primaryBand[1]}
          peakNm={analyte.peakWavelength}
          sampleName={`${m.id} · simulated`}
          isRejected={rec.isRejected}
          hasMeasurement
          isScanning={busy}
        />

        <section className="card">
          <div className="card__body">
            <Disclosure label="Technical view" summary={`${r.executionTimeMs} ms pipeline`}>
              <div className="metrics twin-tech">
                {(
                  [
                    ['Source', 'SIMULATED — production simulator, seeded'],
                    ['Measurement ID / seed', `${m.id} / ${m.seed}`],
                    ['Wavelength range', `${STANDARD_WAVELENGTHS[0]}–${STANDARD_WAVELENGTHS.at(-1)} nm`],
                    ['Spectral points', `${STANDARD_WAVELENGTHS.length}`],
                    ['Absorbance peak', `${peakNm} nm`],
                    ['Device profile', `${device.name}${device.isCalibrated ? '' : ' · uncalibrated'}`],
                    ['Applied / detected shift', `${params.shiftPx} px / ${r.shiftPx} px`],
                    ['QC', `${r.qc.overallStatus} — ${[r.qc.saturationCheck, r.qc.signalStrengthCheck, r.qc.spectralShiftCheck, r.qc.calibrationRangeCheck, r.qc.turbidityInterferenceCheck].map((c) => `${c.name} ${c.status}`).join(', ')}`],
                    ['OOD', `${r.ood.status} · score ${r.ood.score}`],
                    ['Model selected', MODEL_NAME[rec.selectedModel]],
                    ['Predicted concentration', rec.isRejected ? 'withheld' : `${fmt(rec.concentration)} ${rec.unit}`],
                    ['Uncertainty', rec.isRejected ? 'withheld' : `± ${fmt(rec.uncertainty)} ${rec.unit}`],
                    ['Grating / wedge', `${GRATING_LINES_PER_MM} lines/mm · α₀ ${deg(WEDGE_ANGLE_RAD)}°`],
                    ['Sensor calibration', `λ(p) = ${SENSOR_CALIBRATION.slope.toFixed(4)}·p + ${SENSOR_CALIBRATION.intercept.toFixed(2)} nm · R² ${SENSOR_CALIBRATION.r2} · residual ${SENSOR_CALIBRATION.residualRms} nm`],
                    ['Pipeline time', `${r.executionTimeMs} ms`],
                  ] as const
                ).map(([k, v]) => (
                  <div className="metric" key={k}>
                    <span>{k}</span>
                    <span className="mono">{v}</span>
                  </div>
                ))}
              </div>
            </Disclosure>
          </div>
        </section>

        <p className="twin-disclaimer">
          Interactive digital twin. Geometry follows the LISA build plan; ray paths are an explanatory
          approximation (grating equation + pinhole projection), not an electromagnetic simulation. Every number
          comes from LISA’s production simulator and inference pipeline and is simulated — not an experimental
          measurement.
        </p>
      </section>

      {/* ---------------- Jury bar ---------------- */}
      {jury && (
        <div className="twin-jury" role="region" aria-label="Jury mode">
          <div className="twin-jury__progress" aria-hidden="true">
            <span style={{ width: `${((jury.step + 1) / JURY.length) * 100}%` }} />
          </div>
          <div className="twin-jury__body">
            <div className="twin-jury__meta">
              <span className="mono">
                {String(jury.step + 1).padStart(2, '0')} / {JURY.length}
              </span>
              <span className="twin-jury__title">{JURY[jury.step].title}</span>
            </div>
            <p className="twin-jury__caption">{JURY[jury.step].caption(m, busy)}</p>
          </div>
          <div className="twin-jury__actions">
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => setJury((j) => (j ? { ...j, paused: !j.paused } : j))}
            >
              {jury.paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
              {jury.paused ? 'Continue' : 'Pause'}
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              disabled={jury.step >= JURY.length - 1}
              onClick={() => setJury((j) => (j ? { step: j.step + 1, paused: true } : j))}
            >
              <SkipForward size={14} aria-hidden="true" /> Step
            </button>
            <button type="button" className="btn btn--ghost btn--icon" aria-label="Exit jury mode" onClick={() => setJury(null)}>
              <X size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DigitalTwin;
