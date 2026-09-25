// LISA: Physical hardware roadmap
// The clip-on optical train, its bill of materials, and the deployment context.
// Cost figures here are the ones from the original prototype brief, carried
// over unchanged.

import React, { Suspense, lazy } from 'react';
import { Modal } from './ui/Modal';

// three.js lives in the digital-twin chunk; only fetch it when this modal opens.
const HardwareViewer = lazy(() => import('../digitalTwin/HardwareViewer'));

interface HardwareRoadmapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const OPTICAL_TRAIN = [
  {
    name: 'High-CRI LED',
    spec: 'White light source',
    role: 'Illuminates the sample across the visible band so the absorbance spectrum is well conditioned.',
  },
  {
    name: '10 mm cuvette',
    spec: 'Water + reagent',
    role: 'Fixes the optical path length at 10 mm — the path length the Beer-Lambert calibration assumes.',
  },
  {
    name: 'Razor slit',
    spec: '0.15 mm gap',
    role: 'Collimates the beam into a line, which is what lets a phone camera resolve spectral bands.',
  },
  {
    name: 'Grating film',
    spec: '1000 lines/mm',
    role: 'Disperses the beam into a spectrum across the sensor before it is captured.',
  },
  {
    name: 'Phone CMOS',
    spec: 'LISA engine',
    role: 'Captures 151 bands at 2 nm spacing and runs the calibration, model and quality checks.',
  },
];

const BOM: {
  component: string;
  spec: string;
  prototype: string;
  scale: string;
  total?: boolean;
}[] = [
  {
    component: 'Optical tube & housing',
    spec: '300 gsm black card / moulded PP',
    prototype: '₹60',
    scale: '₹40',
  },
  {
    component: 'Diffraction grating',
    spec: '1000 lines/mm film',
    prototype: '₹200',
    scale: '₹80',
  },
  {
    component: 'Entrance slit & optics',
    spec: 'Dual razor blade / etched foil',
    prototype: '₹20',
    scale: '₹15',
  },
  {
    component: 'Illumination port',
    spec: 'USB LED stick / diffuser',
    prototype: '₹120',
    scale: '₹50',
  },
  {
    component: 'Total hardware',
    spec: 'Clip-on water lab',
    prototype: '₹400',
    scale: '₹185',
    total: true,
  },
  {
    component: 'Reagent pack (50 tests)',
    spec: 'Dry powder blister pods',
    prototype: '₹100',
    scale: '₹50 (₹1/test)',
  },
];

export const HardwareRoadmapModal: React.FC<HardwareRoadmapModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Physical LISA"
      subtitle="The foldscope-style clip-on optical train this software is built to sit behind, and what it costs to make."
      size="wide"
    >
      <blockquote
        style={{
          margin: 0,
          paddingLeft: 16,
          borderLeft: '2px solid var(--accent)',
          fontSize: 14,
          lineHeight: 1.6,
          color: 'var(--ink-2)',
          fontStyle: 'italic',
        }}
      >
        “Foldscope made microscopy cheap enough for everyone. LISA does the same for water
        chemistry.”
        <span
          style={{
            display: 'block',
            marginTop: 6,
            fontStyle: 'normal',
            fontSize: 12.5,
            color: 'var(--ink-3)',
          }}
        >
          Built on Feng et al., <em>Sensors &amp; Actuators B</em> (2026).
        </span>
      </blockquote>

      <Suspense fallback={<div className="empty" style={{ height: 360 }}>Loading 3D design…</div>}>
        <HardwareViewer />
      </Suspense>

      <div className="field">
        <span className="field__label">Optical train</span>
        <div className="steps">
          {OPTICAL_TRAIN.map((step, idx) => (
            <div className="step" key={step.name}>
              <span className="step__marker" aria-hidden="true">
                {idx + 1}
              </span>
              <div className="step__text">
                <span className="step__name">
                  {step.name}
                  <span
                    className="mono"
                    style={{ marginLeft: 8, fontSize: 11.5, fontWeight: 400, color: 'var(--ink-3)' }}
                  >
                    {step.spec}
                  </span>
                </span>
                <span className="step__detail">{step.role}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field__label">
          <span>Bill of materials</span>
          <span className="field__value">Per unit, INR</span>
        </span>

        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Component</th>
                <th scope="col">Specification</th>
                <th scope="col" className="table__num">
                  Prototype
                </th>
                <th scope="col" className="table__num">
                  Scale 10k
                </th>
              </tr>
            </thead>
            <tbody>
              {BOM.map((row) => (
                <tr key={row.component}>
                  <td className={row.total ? 'table__strong' : undefined}>{row.component}</td>
                  <td style={{ color: 'var(--ink-2)' }}>{row.spec}</td>
                  <td className={`table__num${row.total ? ' table__strong' : ''}`}>
                    {row.prototype}
                  </td>
                  <td
                    className={`table__num${row.total ? ' table__strong' : ''}`}
                    style={row.total ? undefined : { color: 'var(--ink-2)' }}
                  >
                    {row.scale}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="callout callout--neutral">
        <div>
          <strong>Jal Jeevan Mission deployment.</strong> India has 24.8 lakh trained rural women
          performing Field Test Kit (FTK) tests. LISA replaces subjective naked-eye colour
          comparison charts with digital, geotagged, unforgeable telemetry.
        </div>
      </div>
    </Modal>
  );
};
