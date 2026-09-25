// LISA: Device Calibration & Sensor Normalization
// Adapts optical sensor responses across heterogeneous smartphone cameras

import { DeviceProfile } from '../types';

export const DEMO_DEVICES: DeviceProfile[] = [
  {
    id: 'device-a-reference',
    name: 'Device A (Reference Smartphone)',
    description: 'Calibrated laboratory CMOS sensor, linear optical response, neutral color matrix.',
    colorTemperatureBias: 'neutral',
    spectralSensitivity: new Array(151).fill(1.0),
    noiseRms: 0.012,
    gainDrift: 0.0,
    wavelengthOffsetPx: 0,
    fingerprint: 'LISA-7F42-REF1',
    isCalibrated: true,
  },
  {
    id: 'device-b-warm',
    name: 'Device B (Warm Sensor / Flagship)',
    description: 'Warm color profile tuning; elevated red phosphor gain (+8%), blue attenuation (-6%).',
    colorTemperatureBias: 'warm',
    spectralSensitivity: Array.from({ length: 151 }, (_, i) => 0.94 + 0.14 * (i / 150)),
    noiseRms: 0.016,
    gainDrift: 0.04,
    wavelengthOffsetPx: 1,
    fingerprint: 'LISA-9A18-WRM2',
    isCalibrated: false,
  },
  {
    id: 'device-c-cool',
    name: 'Device C (Cool Sensor / Mid-range)',
    description: 'Cool daylight bias; elevated blue diode sensitivity (+7%), red phosphor attenuation (-5%).',
    colorTemperatureBias: 'cool',
    spectralSensitivity: Array.from({ length: 151 }, (_, i) => 1.07 - 0.12 * (i / 150)),
    noiseRms: 0.019,
    gainDrift: -0.03,
    wavelengthOffsetPx: -1,
    fingerprint: 'LISA-4D88-COL3',
    isCalibrated: false,
  },
  {
    id: 'device-d-budget',
    name: 'Device D (Budget High-Noise Sensor)',
    description: 'Sub-₹8,000 phone camera; higher dark current shot noise, non-uniform optical roll-off.',
    colorTemperatureBias: 'budget-noisy',
    spectralSensitivity: Array.from({ length: 151 }, (_, i) => 0.92 + 0.08 * Math.sin((i / 150) * Math.PI)),
    noiseRms: 0.042,
    gainDrift: 0.08,
    wavelengthOffsetPx: 2,
    fingerprint: 'LISA-B231-BGT4',
    isCalibrated: false,
  },
];

export interface DeviceCalibrationStep {
  stepIndex: number;
  title: string;
  description: string;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED';
}

export function normalizeDeviceSpectrum(
  rawIntensities: number[],
  device: DeviceProfile
): number[] {
  if (!device.isCalibrated) {
    return [...rawIntensities];
  }

  // Multiply by inverse sensitivity curve to map back to canonical reference space
  return rawIntensities.map((val, i) => {
    const sensitivity = device.spectralSensitivity[i] || 1.0;
    return val / (sensitivity || 1.0);
  });
}

// Generates dynamic fingerprint based on device ID and calibration timestamp
export function generateDeviceFingerprint(deviceId: string): string {
  const hash = Math.abs(
    deviceId.split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)
  ).toString(16).toUpperCase().padStart(8, '0');

  return `LISA-${hash.slice(0, 4)}-${hash.slice(4, 8)}`;
}
