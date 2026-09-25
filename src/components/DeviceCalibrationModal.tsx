// LISA: Device calibration
// A guided five-step instrument setup, with the device catalogue and live
// fingerprint treated as a visible record rather than a wall of telemetry.

import React, { useState } from 'react';
import { Check, RefreshCw, Sparkles } from 'lucide-react';
import { DeviceProfile } from '../types';
import { DEMO_DEVICES, generateDeviceFingerprint } from '../engine/deviceCalibration';
import { Modal } from './ui/Modal';

interface DeviceCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDevice: DeviceProfile;
  onSelectDevice: (device: DeviceProfile) => void;
}

const CALIBRATION_STEPS = [
  {
    name: 'Reference white card reflection',
    detail: 'Establishes the illumination profile reaching the sensor.',
  },
  {
    name: 'Reagent blank optical baseline',
    detail: 'Records the solvent-only response for blank correction.',
  },
  {
    name: 'CMOS colour transfer response curve',
    detail: 'Maps this sensor’s channel gains onto the reference instrument.',
  },
  {
    name: 'Dark current and sensor noise matrix',
    detail: 'Characterises read noise for the uncertainty budget.',
  },
  {
    name: 'Model registration and hash fingerprint',
    detail: 'Seals the profile so every reading is traceable to it.',
  },
];

export const DeviceCalibrationModal: React.FC<DeviceCalibrationModalProps> = ({
  isOpen,
  onClose,
  activeDevice,
  onSelectDevice,
}) => {
  const [calibrating, setCalibrating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const handleStartCalibration = () => {
    setCalibrating(true);
    setCurrentStep(0);

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= CALIBRATION_STEPS.length - 1) {
          clearInterval(interval);
          setCalibrating(false);
          onSelectDevice({
            ...activeDevice,
            isCalibrated: true,
            fingerprint: generateDeviceFingerprint(activeDevice.id),
          });
          return prev;
        }
        return prev + 1;
      });
    }, 450);
  };

  const allDone = activeDevice.isCalibrated;
  const doneCount = allDone ? CALIBRATION_STEPS.length : currentStep;
  const progress = (doneCount / CALIBRATION_STEPS.length) * 100;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Calibrate device"
      subtitle="Every smartphone sensor has its own optical coatings, colour matrix and white balance. Calibrating builds a transfer function for this handset so readings are comparable to a laboratory instrument."
      size="default"
    >
      <div className="field">
        <span className="field__label">Device profile</span>
        <div className="option-grid option-grid--2">
          {DEMO_DEVICES.map((dev) => {
            const selected = dev.id === activeDevice.id;
            return (
              <button
                key={dev.id}
                type="button"
                className="option"
                aria-pressed={selected}
                onClick={() => onSelectDevice(dev)}
              >
                <span className="option__row">
                  <span className="option__title">{dev.name}</span>
                  {dev.isCalibrated && (
                    <span className="icon-pass" aria-label="Calibrated">
                      <Check size={15} aria-hidden="true" />
                    </span>
                  )}
                </span>
                <span className="option__meta">{dev.description}</span>
                <span className="option__meta mono" style={{ fontSize: 11.5 }}>
                  {dev.fingerprint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="field">
        <div className="field__label">
          <span>Calibration protocol</span>
          <span className="field__value">{activeDevice.name}</span>
        </div>

        <div className="progress" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Calibration progress">
          <div className="progress__fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="steps" style={{ marginTop: 8 }}>
          {CALIBRATION_STEPS.map((step, idx) => {
            const done = allDone || idx < currentStep;
            const active = calibrating && idx === currentStep;
            const state = done ? 'done' : active ? 'active' : 'pending';

            return (
              <div className="step" data-state={state} key={step.name}>
                <span className="step__marker" aria-hidden="true">
                  {done ? <Check size={12} /> : idx + 1}
                </span>
                <div className="step__text">
                  <span className="step__name">
                    {step.name}
                    <span className="sr-only">
                      {done ? ' — complete' : active ? ' — in progress' : ' — pending'}
                    </span>
                  </span>
                  <span className="step__detail">{step.detail}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <span className="field__hint mono">
          Fingerprint {activeDevice.fingerprint}
        </span>
        <button
          type="button"
          className="btn btn--primary"
          onClick={handleStartCalibration}
          disabled={calibrating}
        >
          {calibrating ? (
            <>
              <RefreshCw className="btn__icon" size={15} aria-hidden="true" />
              <span>Calibrating…</span>
            </>
          ) : (
            <>
              <Sparkles className="btn__icon" size={15} aria-hidden="true" />
              <span>{allDone ? 'Recalibrate device' : 'Run calibration'}</span>
            </>
          )}
        </button>
      </div>
    </Modal>
  );
};
