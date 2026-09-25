// LISA Hardware viewer — the digital twin's 3D attachment without the phone,
// for the Hardware design modal. It opens assembled, then comes apart once so
// the optical train reads left to right. The light path is the clean 0.40 mg P/L
// scenario from the production simulator.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { Segmented } from '../components/ui/Segmented';
import { TwinScene, PartId, ModeId, PART_NAMES } from './TwinScene';
import { SCENARIOS, runTwinMeasurement, transmittedColor } from './twinModel';
import { partInfo } from './twinInfo';
import './digitalTwin.css';

const HardwareViewer: React.FC = () => {
  const el = useRef<HTMLDivElement>(null);
  const scene = useRef<TwinScene | null>(null);
  const failed = !('WebGL2RenderingContext' in window);
  const [mode, setMode] = useState<ModeId>('normal');
  const [lightOn, setLightOn] = useState(true);
  const [selected, setSelected] = useState<PartId | null>(null);

  const m = useMemo(() => runTwinMeasurement(SCENARIOS[0].params, SCENARIOS[0].deviceId, 1), []);

  useEffect(() => {
    try {
      scene.current = new TwinScene(el.current!, setSelected, () => {}, true);
    } catch (err) {
      console.warn('Hardware viewer: WebGL unavailable', err);
    }
    // Break it apart once, shortly after opening, so the motion explains the build.
    const t = window.setTimeout(() => setMode('exploded'), 900);
    return () => {
      window.clearTimeout(t);
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);

  useEffect(() => scene.current?.setMode(mode), [mode]);
  useEffect(() => scene.current?.setSelected(selected), [selected]);
  useEffect(() => {
    scene.current?.setOptics({
      lightOn,
      reveal: 9,
      sensorIntensities: m.sim.sampleIntensities,
      transmitted: transmittedColor(m.sim.blankIntensities, m.sim.sampleIntensities).rgb,
      showSample: true,
    });
  }, [lightOn, m]);

  const info = selected ? partInfo(selected, m) : null;

  return (
    <div className="field">
      <span className="field__label">
        <span>3D design</span>
        <a className="field__value" href="#/twin">
          Open full digital twin →
        </a>
      </span>
      <div className="twin-stage twin-stage--compact" aria-label="3D model of the LISA attachment">
        <div ref={el} className="twin-stage__gl" />
        {failed && <div className="twin-stage__fallback">WebGL is not available, so the 3D model cannot render.</div>}
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
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            aria-pressed={lightOn}
            onClick={() => setLightOn((v) => !v)}
          >
            <Lightbulb size={14} aria-hidden="true" /> {lightOn ? 'Light on' : 'Light off'}
          </button>
        </div>
      </div>
      <p className="field__hint">
        {info && selected ? (
          <>
            <strong>{PART_NAMES[selected]}.</strong> {info.short}
          </>
        ) : (
          'Drag to rotate, scroll to zoom, click a part. The phone (camera + LISA app) clips on behind the grating; simulated light path.'
        )}
      </p>
    </div>
  );
};

export default HardwareViewer;
