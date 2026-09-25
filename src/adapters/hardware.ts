// LISA: Pluggable Hardware Adapter Interface
// Abstraction layer enabling future physical Foldscope optical attachments to plug directly into the LISA software engine

import { SourceMode } from '../types';
import { simulateSpectrum } from '../engine/simulator';

export interface HardwareStatus {
  connected: boolean;
  batteryLevel?: number;
  ledStatus: 'ON' | 'OFF' | 'DRIFT';
  integrationTimeMs: number;
  temperatureC?: number;
  serialNumber?: string;
}

export interface RawMeasurement {
  intensity: number[];
  wavelengths?: number[];
  timestamp: string;
  sourceMode: SourceMode;
  deviceId?: string;
}

export interface HardwareAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  capture(): Promise<RawMeasurement>;
  getStatus(): HardwareStatus;
}

// Simulated Hardware Adapter for Demonstration & Testing
export class SimulatedHardwareAdapter implements HardwareAdapter {
  private isConnected: boolean = false;
  private integrationTimeMs: number = 33; // 30 fps
  private serialNumber: string = 'LISA-HW-001-PROTO';

  public async connect(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 350));
    this.isConnected = true;
  }

  public async disconnect(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    this.isConnected = false;
  }

  public async capture(): Promise<RawMeasurement> {
    if (!this.isConnected) {
      throw new Error('Hardware module not connected.');
    }
    await new Promise((resolve) => setTimeout(resolve, 200));

    const sim = simulateSpectrum({
      analyte: 'phosphate',
      concentration: 0.40,
      noiseLevel: 0.015,
      illuminationDrift: 0.0,
      shiftPx: 0,
      isSaturated: false,
      turbidityAU: 0.0,
      colorInterferenceAU: 0.0,
    });

    return {
      intensity: sim.sampleIntensities,
      wavelengths: sim.wavelengths,
      timestamp: new Date().toISOString(),
      sourceMode: 'HARDWARE',
      deviceId: this.serialNumber,
    };
  }

  public getStatus(): HardwareStatus {
    return {
      connected: this.isConnected,
      batteryLevel: 92,
      ledStatus: this.isConnected ? 'ON' : 'OFF',
      integrationTimeMs: this.integrationTimeMs,
      temperatureC: 24.5,
      serialNumber: this.serialNumber,
    };
  }
}
